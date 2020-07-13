import {Component} from "./component.js";
import {Logger} from "./logger.js";
import {StorageUtils} from "./storageUtils.js";

const log = Logger.logger("MessageService");

const IDLE_INTERVAL = 60; // seconds
const FULLSCREEN_TIMEOUT = 3600; // seconds

export class MessageService extends Component {
  constructor(receiver) {
    super(receiver);

    this.fetching = false;
    this.lastUsageDaysPending = false;
  }

  async init() {
    log("init");

    // Let's take the last date of usage.
    let lastUsageDays = await StorageUtils.getLastUsageDays();
    if (!lastUsageDays) {
       lastUsageDays = {
         date: null,
         count: 0,
       };
    }
    this.lastUsageDays = lastUsageDays;

    this.service = await ConfigUtils.getSPService();

    // Fetch new messages at startup time.
    this.maybeFetchMessages();

    setInterval(() => this.maybeFetchMessages(),
                (await ConfigUtils.getMessageServiceInterval() * 1000));
  }

  async maybeFetchMessages() {
    log("maybe fetch messages");

    if (this.fetching) {
      log("Already fetching data. Ignore request.");
      return;
    }

    this.fetching = true;
    const data = await this.fetchInternal();
    this.fetching = false;

    if (!data || data.status !== "ok") {
      log("No new messages");
      return;
    }

    data.messages.forEach(message => this.syncProcessMessage(message));
  }

  async fetchInternal() {
    const stateTokenData = await StorageUtils.getStateTokenData();
    const headers = new Headers();

    headers.append("Content-Type", "application/json");

    const request = new Request(this.service + "browser/oauth/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        // stateTokenData can be null.
        state_token: stateTokenData,
      }),
    });

    try {
      let resp = await fetch(request, {cache: "no-cache"});
      if (resp.status !== 200) {
        return null;
      }

      return await resp.json();
    } catch (e) {
      return null;
    }
  }

  syncProcessMessage(message) {
     switch (message.type) {
       case "showURL":
         this.processMessageShowURL(message);
         break;

       default:
         log("Unsupported message type: " + message.type);
         break;
    }
  }

  async processMessageShowURL(message) {
    log(`Processing showUrl message. URL ${message.url} - idle ${message.idle} - background ${message.background}`);

    if (!message.idle) {
      await this.openTab(message.url, message.background);
      return;
    }

    // The current window is in fullscreen. Let's wait.
    let w = await browser.windows.getLastFocused();
    if (!w || w.type.state === "fullscreen") {
      setTimeout(() => this.processMessageShowURL(message), FULLSCREEN_TIMEOUT * 1000);
      return;
    }

    // As soon as in idle...
    await this.whenIdle(() => this.openTab(message.url, message.inBackground));
  }

  // URLs can contain 'magic' words. These will be replaced with values.
  // Here the list of the supported keywords and their meanings:
  // - PROXYENABLED - replaced with 'true' or 'false', based on the proxy state.
  // - VERSION - the extension version.
  // - USAGEDAYS - number of days with the proxy enabled (at least for 1 request)
  async formatUrl(url) {
    let self = await browser.management.getSelf();

    url = url.replace(/PROXYENABLED/g, this.cachedProxyState === PROXY_STATE_ACTIVE ? "true" : "false")
             .replace(/VERSION/g, self.version)
             .replace(/USAGEDAYS/g, this.lastUsageDays.count);

    return browser.runtime.getURL(url);
  }

  async openTab(url, background) {
    browser.tabs.create({
      url: await this.formatUrl(url),
      active: !background,
    });
  }

  async whenIdle(cb) {
    log("Wait for idle state");

    const state = await browser.idle.queryState(IDLE_INTERVAL);
    if (state === "idle") {
      cb();
      return;
    }

    browser.idle.setDetectionInterval(IDLE_INTERVAL);
    browser.idle.onStateChanged.addListener(function listener(state) {
      if (state === "idle") {
        browser.idle.onStateChanged.removeListener(listener);
        cb();
      }
    });
  }

  setProxyState(proxyState) {
    super.setProxyState(proxyState);

    if (this.cachedProxyState !== PROXY_STATE_ACTIVE) {
      return;
    }

    if (this.lastUsageDaysPending) {
      return;
    }

    const options = { year: "numeric", month: "2-digit", day: "2-digit" };
    const dateTimeFormat = new Intl.DateTimeFormat("en-US", options).format;

    let now = dateTimeFormat(Date.now());
    if (this.lastUsageDays.date === now) {
      return;
    }

    this.lastUsageDaysPending = true;
    this.lastUsageDays.date = now;
    this.lastUsageDays.count += 1;

    StorageUtils.setLastUsageDays(this.lastUsageDays).
      then(_ => { this.lastUsageDaysPending = false; });
  }
}
