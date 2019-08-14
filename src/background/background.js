// If run() fails, it will be retriggered after this timeout (in milliseconds)
const RUN_TIMEOUT = 5000; // 5 secs

class Background {
  constructor() {
    log("constructor");

    this.observers = new Set();

    this.connectivity = new Connectivity(this);
    this.fxa = new FxAUtils(this);
    this.net = new Network(this);
    this.survey = new Survey(this);
    this.ui = new UI(this);

    this.proxyState = PROXY_STATE_LOADING;

    // Timeout for run() when offline is detected.
    this.runTimeoutId = 0;
  }

  async init() {
    const prefs = await browser.experiments.proxyutils.settings.get({});
    debuggingMode = prefs.value.debuggingEnabled;

    log("init");

    // Let's initialize the observers.
    this.observers.forEach(observer => {
      observer.init(prefs);
    });

    // All good. Let's start.
    this.firstRun();
  }

  async firstRun() {
    log("first run!");

    let { proxyState } = await browser.storage.local.get(["proxyState"]);
    if (proxyState === PROXY_STATE_ACTIVE) {
      this.setProxyState(PROXY_STATE_ACTIVE);
      this.ui.update();
      return;
    }

    await this.run();
  }

  // This method is executed multiple times: at startup time, and each time we
  // go back online. It computes the proxy state.
  async run() {
    log("run!");

    clearTimeout(this.runTimeoutId);

    // Here we generate the current proxy state.
    await this.computeProxyState();

    // UI
    this.ui.update();
  }

  setProxyState(proxyState) {
    this.proxyState = proxyState;

    this.observers.forEach(observer => {
      observer.setProxyState(proxyState);
    });
  }

  setOfflineAndStartRecoveringTimer() {
    log("set offline state and start the timer");

    this.setProxyState(PROXY_STATE_OFFLINE);

    clearTimeout(this.runTimeoutId);
    this.runTimeoutId = setTimeout(_ => this.run(), RUN_TIMEOUT);
  }

  // Set this.proxyState based on the current settings.
  async computeProxyState() {
    log("computing status - currently: " + this.proxyState);

    // This method will schedule the token generation, if needed.
    if (this.tokenGenerationTimeout) {
      clearTimeout(this.tokenGenerationTimeout);
      this.tokenGenerationTimeout = 0;
    }

    // We want to keep these states.
    let currentState = this.proxyState;
    if (currentState !== PROXY_STATE_AUTHFAILURE &&
        currentState !== PROXY_STATE_PROXYERROR &&
        currentState !== PROXY_STATE_PROXYAUTHFAILED) {
      this.setProxyState(PROXY_STATE_UNAUTHENTICATED);
    }

    // Something else is in use.
    let otherProxyInUse = await this.hasProxyInUse();
    if (otherProxyInUse) {
      this.setProxyState(PROXY_STATE_OTHERINUSE);
    }

    // All seems good. Let's see if the proxy should enabled.
    if (this.proxyState === PROXY_STATE_UNAUTHENTICATED) {
      let { proxyState } = await browser.storage.local.get(["proxyState"]);
      if (proxyState === PROXY_STATE_INACTIVE) {
        this.setProxyState(PROXY_STATE_INACTIVE);
      } else if ((await this.fxa.maybeGenerateTokens())) {
        this.setProxyState(PROXY_STATE_CONNECTING);

        // Note that we are not waiting for this function. The code moves on.
        this.testProxyConnection();
      }
    }

    // If we are here we are not active yet. At least we are connecting.
    // Restore default settings.
    if (currentState !== this.proxyState) {
      this.net.inactiveSteps();
    }

    log("computing status - final: " + this.proxyState);
    return currentState !== this.proxyState;
  }

  async testProxyConnection() {
    try {
      await this.net.testProxyConnection();

      await browser.storage.local.set({proxyState: PROXY_STATE_ACTIVE});
      this.setProxyState(PROXY_STATE_ACTIVE);

      this.net.afterConnectionSteps();
      this.ui.afterConnectionSteps();
    } catch (e) {
      this.setOfflineAndStartRecoveringTimer();
      this.ui.update();
    }
  }

  async enableProxy(value) {
    log("enabling proxy: " + value);

    // We support the changing of proxy state only from some states.
    if (this.proxyState !== PROXY_STATE_UNAUTHENTICATED &&
        this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_INACTIVE &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return;
    }

    // Let's force a new proxy state, and then let's compute it again.
    let proxyState = value ? PROXY_STATE_CONNECTING : PROXY_STATE_INACTIVE;
    await browser.storage.local.set({proxyState});

    if (await this.computeProxyState()) {
      this.ui.update();
    }
  }

  async auth() {
    // non authenticate state.
    this.setProxyState(PROXY_STATE_UNAUTHENTICATED);

    try {
      await this.fxa.authenticate();
      log("Authentication completed");

      // We are in an inactive state at this point.
      this.setProxyState(PROXY_STATE_INACTIVE);

      // Let's enable the proxy.
      return this.enableProxy(true);
    } catch (error) {
      log(`Authentication failed: ${error.message}`);
      return this.authFailure();
    }
  }

  async authFailure() {
    this.setProxyState(PROXY_STATE_AUTHFAILURE);
    await browser.storage.local.set({
      proxyState: this.proxyState,
      refreshTokenData: null,
      proxyTokenData: null,
      profileTokenData: null,
      profileData: null,
    });
  }

  async onConnectivityChanged(connectivity) {
    log("connectivity changed!");
    this.net.increaseConnectionIsolation();

    // Offline -> online.
    if ((this.proxyState === PROXY_STATE_OFFLINE) && connectivity) {
      await this.run();
    }
  }

  async hasProxyInUse() {
    let proxySettings = await browser.proxy.settings.get({});
    return ["manual", "autoConfig", "autoDetect"].includes(proxySettings.value.proxyType);
  }

  async proxyAuthenticationFailed() {
    if (this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return;
    }

    this.setProxyState(PROXY_STATE_PROXYAUTHFAILED);

    await browser.storage.local.set({
      proxyTokenData: null,
      profileTokenData: null,
      profileData: null,
    });

    this.ui.update();
    await this.fxa.maybeGenerateTokens();
  }

  proxyGenericError() {
    if (this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return;
    }

    this.setProxyState(PROXY_STATE_PROXYERROR);
    this.ui.update();
  }

  skipProxy(requestInfo, url) {
    if (this.ui.isTabExempt(requestInfo.tabId)) {
      return true;
    }

    if (this.fxa.isAuthUrl(url.origin)) {
      return true;
    }

    return false;
  }

  async proxySettingsChanged() {
    const hasChanged = await this.computeProxyState();
    if (hasChanged) {
      this.ui.update();
    }
  }

  handleEvent(type, data) {
    switch (type) {
      case "authenticationFailed":
        return this.authFailure();

      case "authenticationRequired":
        return this.auth();

      case "connectivityChanged":
        return this.onConnectivityChanged(data.connectivity);

      case "enableProxy":
        return this.enableProxy(data.enabledState);

      case "excludedDomains":
        return this.fxa.excludedDomains();

      case "managerAccountURL":
        return this.fxa.manageAccountURL();

      case "proxyAuthenticationFailed":
        return this.proxyAuthenticationFailed();

      case "proxyGenericError":
        return this.proxyGenericError();

      case "proxySettingsChanged":
        return this.proxySettingsChanged();

      case "skipProxy":
        return this.skipProxy(data.requestInfo, data.url);

      case "tokenGenerated":
        return this.net.tokenGenerated(data.tokenType, data.tokenValue);

      case "waitForTokenGeneration":
        return this.fxa.waitForTokenGeneration();

      default:
        console.error("Invalid event: " + type);
        throw new Error("Invalid event: " + type);
    }
  }

  registerObserver(observer) {
    this.observers.add(observer);
  }
}

let background = new Background();
background.init();
