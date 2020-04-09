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
  }

  async init() {
    log("init");

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

    // eslint-disable-next-line verify-await/check
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

  async openTab(url, background) {
    browser.tabs.create({
      url,
      active: !background,
    });
  }

  async whenIdle(cb) {
    log("Wait for udle state");

    const state = await browser.idle.queryState(IDLE_INTERVAL);
    if (state === "idle") {
      // eslint-disable-next-line verify-await/check
      cb();
      return;
    }

    // eslint-disable-next-line verify-await/check
    browser.idle.setDetectionInterval(IDLE_INTERVAL);
    browser.idle.onStateChanged.addListener(function listener(state) {
      if (state === "idle") {
        // eslint-disable-next-line verify-await/check
        browser.idle.onStateChanged.removeListener(listener);
        // eslint-disable-next-line verify-await/check
        cb();
      }
    });
  }
}
