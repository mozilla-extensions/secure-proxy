import {ConnectionTester} from "./connection.js";
import {Connectivity} from "./connectivity.js";
import {ExternalHandler} from "./external.js";
import {FxAUtils} from "./fxa.js";
import {Network} from "./network.js";
import {OfflineManager} from "./offline.js";
import {ProxyDownChecker} from "./proxyDownChecker.js";
import {ProxyStateObserver} from "./proxyStateObserver.js";
import {StorageUtils} from "./storageUtils.js";
import {Survey} from "./survey.js";
import {Telemetry} from "./telemetry.js";
import {UI} from "./ui.js";

// If set to true, it imports tester.js and it execs the tests.
const RUN_TESTS = false;

class Main {
  constructor() {
    log("constructor");

    // We want to avoid the processing of events during the initialization.
    // Setting handlingEvent to true, we simulate the processing of an event
    // and, because of this, any new incoming event will be stored in a queue
    // and processed only at the end of the initialization, when
    // this.syncProcessPendingEvents() is called.
    this.handlingEvent = true;
    this.pendingEvents = [];

    this.proxyState = PROXY_STATE_LOADING;

    // Timeout for run() when offline is detected.
    this.runTimeoutId = 0;

    this.observers = new Set();

    // All the modules, at the end.
    this.connectivity = new Connectivity(this);
    this.externalHandler = new ExternalHandler(this);
    this.fxa = new FxAUtils(this);
    this.offlineManager = new OfflineManager(this);
    this.net = new Network(this);
    this.proxyDownChecker = new ProxyDownChecker(this);
    this.proxyStateObserver = new ProxyStateObserver(this);
    this.survey = new Survey(this);
    this.telemetry = new Telemetry(this);
    this.ui = new UI(this);
  }

  async init() {
    const prefs = await browser.experiments.proxyutils.settings.get({});
    log("init");

    // Let's initialize the observers.
    for (let observer of this.observers) {
      await observer.init(prefs);
    }

    // All good. Let's start.
    await this.firstRun();

    // Let's start the testing, if we have to.
    if (RUN_TESTS) {
      try {
        let {Tester} = await import("../tests/background/tester.js");
        // eslint-disable-next-line verify-await/check
        await Tester.run(this);
      } catch (e) {
        console.error("RUN_TESTS is true, but no tester.js included!");
      }
    }

    // Inititialization completed. Let's process any pending event received in
    // the meantime.
    this.handlingEvent = false;
    this.syncProcessPendingEvents();
  }

  async firstRun() {
    log("first run!");

    let proxyState = await StorageUtils.getProxyState();
    if (proxyState === PROXY_STATE_ACTIVE) {
      this.setProxyState(PROXY_STATE_ACTIVE);

      // We want to inform only the network component which needs to reset a
      // few preferences.
      this.net.syncAfterConnectionSteps();

      await this.ui.update(false /* no toast here */);
      return;
    }

    await this.run();
  }

  // This method is executed multiple times: at startup time, and each time we
  // go back online. It computes the proxy state.
  async run() {
    log("run!");

    // Here we generate the current proxy state.
    await this.computeProxyState();

    // UI
    const showToast =
       this.proxyState !== PROXY_STATE_ACTIVE &&
       this.proxyState !== PROXY_STATE_INACTIVE;
    await this.ui.update(showToast);
  }

  setProxyState(proxyState) {
    this.proxyState = proxyState;

    for (let observer of this.observers) {
      observer.setProxyState(proxyState);
    }
  }

  // Set this.proxyState based on the current settings.
  async computeProxyState() {
    log("computing status - currently: " + this.proxyState);

    let currentState = this.proxyState;

    // Let's compute the state.
    await this.computeProxyStateInternal();

    // If we are here we are not active yet. At least we are connecting.
    // Restore default settings.
    if (currentState !== this.proxyState) {
      this.net.inactiveSteps();
    }

    log("computing status - final: " + this.proxyState);
    return currentState !== this.proxyState;
  }

  async computeProxyStateInternal() {
    // If all is disabled, we are inactive.
    let proxyState = await StorageUtils.getProxyState();
    if (proxyState === PROXY_STATE_INACTIVE) {
      this.setProxyState(PROXY_STATE_INACTIVE);
      return;
    }

    // Something else is in use.
    if (await this.hasProxyInUse()) {
      this.setProxyState(PROXY_STATE_OTHERINUSE);
      await this.telemetry.syncAddEvent("general", "otherProxyInUse");
      return;
    }

    // Captive portal?
    if (await this.connectivity.inCaptivePortal()) {
      this.setProxyState(PROXY_STATE_CAPTIVE);
      return;
    }

    // We want to keep these states.
    if (this.proxyState === PROXY_STATE_AUTHFAILURE ||
        this.proxyState === PROXY_STATE_PROXYAUTHFAILED) {
      return;
    }

    // All seems good. Let's see if the proxy should enabled.
    let data = await this.fxa.maybeGenerateTokens();
    switch (data.state) {
      case FXA_OK:
        this.setProxyState(PROXY_STATE_CONNECTING);

        // Note that we are not waiting for this function. The code moves on.
        // eslint-disable-next-line verify-await/check
        this.testProxyConnection();
        return;

      case FXA_ERR_AUTH:
        this.setProxyState(PROXY_STATE_UNAUTHENTICATED);
        return;

      case FXA_ERR_NETWORK:
        this.setProxyState(PROXY_STATE_OFFLINE);
        return;

      default:
        throw new Error("Invalid FXA error value!");
    }
  }

  async testProxyConnection() {
    try {
      await ConnectionTester.run(this);
    } catch (e) {
      log("set offline state. This will activate the offline component");
      this.setProxyState(PROXY_STATE_OFFLINE);
      await this.ui.update();
      this.telemetry.syncAddEvent("networking", "connecting");
      this.proxyDownChecker.syncRun();
      return;
    }

    this.setProxyState(PROXY_STATE_ACTIVE);

    this.net.syncAfterConnectionSteps();
    await this.ui.afterConnectionSteps();
  }

  async enableProxy(value, telemetryReason) {
    log(`enabling proxy:  ${value} - ${telemetryReason}`);

    // We support the changing of proxy state only from some states.
    if (this.proxyState !== PROXY_STATE_UNAUTHENTICATED &&
        this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_INACTIVE &&
        this.proxyState !== PROXY_STATE_OFFLINE &&
        this.proxyState !== PROXY_STATE_PROXYERROR &&
        this.proxyState !== PROXY_STATE_PROXYAUTHFAILED &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return;
    }

    let proxyState;
    if (value) {
      this.telemetry.syncAddEvent("general", "proxyEnabled", telemetryReason);
      proxyState = PROXY_STATE_CONNECTING;
    } else {
      this.telemetry.syncAddEvent("general", "proxyDisabled", telemetryReason);
      proxyState = PROXY_STATE_INACTIVE;
    }

    // Let's force a new proxy state, and then let's compute it again.
    await StorageUtils.setProxyState(proxyState);

    if (await this.computeProxyState()) {
      await this.ui.update();
    }
  }

  async auth() {
    this.telemetry.syncAddEvent("fxa", "authStarted");

    // non authenticate state.
    this.setProxyState(PROXY_STATE_UNAUTHENTICATED);

    try {
      await this.fxa.authenticate();

      this.telemetry.syncAddEvent("fxa", "authCompleted");
      log("Authentication completed");
      return true;
    } catch (error) {
      this.telemetry.syncAddEvent("fxa", "authFailed");
      log(`Authentication failed: ${error.message}`);
      // This can be a different error type, but we don't care. We need to
      // report authentication error because there was user interaction.
      return this.authFailure(FXA_ERR_AUTH);
    }
  }

  async authFailure(data) {
    switch (data) {
      case FXA_ERR_AUTH:
        log("authentication failed");
        this.setProxyState(PROXY_STATE_AUTHFAILURE);

        await this.fxa.resetAllTokens();
        await this.ui.update();
        break;

      case FXA_ERR_NETWORK:
        // This is interesting. We are not able to fetch new tokens because
        // the network is probably down. There is not much we can do:
        // - we don't want to show a toast because it would be confusing for
        //   the user.
        // - we don't want to change the proxy state because maybe we will be
        //   able to generate new tokens during the processing of the next
        //   request.
        // So, the current strategy is to ignore this authFailure and wait
        // until the network component complains...
        log("authentication failed by network - ignore");
        break;

      default:
        throw new Error("Invalid FXA error code!", data);
    }
  }

  async onConnectivityChanged(connectivity) {
    log("connectivity changed!");
    this.net.increaseConnectionIsolation();

    // Offline -> online.
    if ((this.proxyState === PROXY_STATE_OFFLINE) && connectivity) {
      await this.run();
    }
  }

  async onCaptivePortalStateChanged(state) {
    log(`captive portal status: ${state}`);

    if (state === "locked_portal") {
      await this.run();
      return;
    }

    await this.maybeActivate("captivePortal");
  }

  async hasProxyInUse() {
    let proxySettings = await browser.proxy.settings.get({});
    return ["manual", "autoConfig", "autoDetect"].includes(proxySettings.value.proxyType);
  }

  async proxyAuthenticationFailed() {
    await this.proxyGenericErrorInternal(PROXY_STATE_PROXYAUTHFAILED);
  }

  async proxyGenericError(maybeProxyDown) {
    await this.proxyGenericErrorInternal(PROXY_STATE_PROXYERROR);

    if (maybeProxyDown) {
      this.proxyDownChecker.syncRun();
    }
  }

  async proxyGenericErrorInternal(state) {
    if (this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return;
    }

    this.setProxyState(state);

    // Let's reset the tokens before udating the UI and before generating new
    // ones.
    await StorageUtils.resetDynamicTokenData();

    await Promise.all([
      this.ui.update(),
      this.fxa.maybeGenerateTokens(),
    ]);
  }

  syncSkipProxy(requestInfo, url) {
    if (this.ui.syncIsTabExempt(requestInfo.tabId)) {
      return true;
    }

    // eslint-disable-next-line verify-await/check
    if (this.fxa.isAuthUrl(url.origin)) {
      return true;
    }

    return false;
  }

  async proxySettingsChanged() {
    const hasChanged = await this.computeProxyState();
    if (hasChanged) {
      await this.ui.update();
    }

    await this.net.checkProxyPassthrough();
  }

  syncPanelShown() {
    // This is done to make the authentication form appearing faster.
    // We ignore the response and just prefetch
    // eslint-disable-next-line verify-await/check
    this.fxa.prefetchWellKnownData();
  }

  async maybeActivate(reason) {
    // If the proxy is off, we should not go back online.
    if (this.proxyState === PROXY_STATE_INACTIVE) {
      return;
    }

    // We want to update the UI only if we were not already active, because, if
    // we are here, in ACTIVE state, it's because we just rotating the tokens.
    if (this.proxyState !== PROXY_STATE_ACTIVE) {
      // We are in an inactive state at this point.
      this.setProxyState(PROXY_STATE_INACTIVE);

      // Let's enable the proxy.
      await this.enableProxy(true, reason);
    }
  }

  // Provides an async response in most cases
  async handleEvent(type, data) {
    log(`handling event ${type}`);

    // In order to avoid race conditions generated by multiple events running
    // at the same time, we process them 1 by 1. If we are already handling an
    // event, we wait until it is concluded.
    if (this.handlingEvent) {
      log(`Queuing event ${type}`);
      await new Promise(resolve => this.pendingEvents.push(resolve));
      log(`Event ${type} resumed`);
    }

    this.handlingEvent = true;

    let returnValue;
    try {
      returnValue = await this.handleEventInternal(type, data);
    } catch (e) {}

    this.handlingEvent = false;
    this.syncProcessPendingEvents();

    return returnValue;
  }

  syncProcessPendingEvents() {
    if (this.pendingEvents.length) {
      log(`Processing the first of ${this.pendingEvents.length} events`);
      // eslint-disable-next-line verify-await/check
      this.pendingEvents.shift()();
    }
  }

  async handleEventInternal(type, data) {
    switch (type) {
      case "authenticationFailed":
        return this.authFailure(data);

      case "authenticationRequired":
        return this.auth();

      case "captivePortalStateChanged":
        return this.onCaptivePortalStateChanged(data.state);

      case "connectivityChanged":
        return this.onConnectivityChanged(data.connectivity);

      case "enableProxy":
        return this.enableProxy(data.enabledState, data.reason);

      case "forceToken":
        return this.fxa.forceToken(data);

      case "managerAccountURL":
        return this.fxa.manageAccountURL();

      case "onlineDetected":
        return this.run();

      case "proxyAuthenticationFailed":
        return this.proxyAuthenticationFailed();

      case "proxyTooManyRequests":
        return this.proxyGenericError(false /* maybe proxy down */);

      case "proxyGenericError":
        return this.proxyGenericError(true /* maybe proxy down */);

      case "proxySettingsChanged":
        return this.proxySettingsChanged();

      case "tokenGenerated":
        return this.maybeActivate("tokenGenerated");

      default:
        console.error("Invalid event: " + type);
        throw new Error("Invalid event: " + type);
    }
  }

  syncHandleEvent(type, data) {
    switch (type) {
      case "skipProxy":
        return this.syncSkipProxy(data.requestInfo, data.url);

      case "panelShown":
        return this.syncPanelShown();

      case "askForProxyToken":
        return this.fxa.askForProxyToken();

      case "excludedDomains":
        return this.fxa.excludedDomains();

      case "telemetry":
        return this.telemetry.syncAddEvent(data.category, data.event);

      case "proxyRequestCallback":
        return this.net.syncNewProxyRequestCallback();

      default:
        console.error("Invalid event: " + type);
        throw new Error("Invalid event: " + type);
    }
  }

  registerObserver(observer) {
    // eslint-disable-next-line verify-await/check
    this.observers.add(observer);
  }
}

let main = new Main();
main.init();
