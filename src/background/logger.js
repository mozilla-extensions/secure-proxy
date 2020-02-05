import {Component} from "./component.js";

// This should be tuned.
const MAX_LOG_MESSAGES = 2000;

let self;

export class Logger extends Component {
  constructor(receiver) {
    super(receiver);
    this.debuggingMode = false;
    this.logMessages = [];

    self = this;
  }

  async init() {
    this.debuggingMode = await ConfigUtils.getDebuggingEnabled();
  }

  syncGetLogs() {
    return this.logMessages;
  }

  static logger(category) {
    return (msg, ...rest) => {
      if (self) {
        self.logInternal(category, msg, rest);
      }
    }
  }

  logInternal(category, msg, rest) {
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    };
    const dateTimeFormat = new Intl.DateTimeFormat("en-US", options).format;

    // eslint-disable-next-line verify-await/check
    const now = dateTimeFormat(Date.now());
    const r = rest.map(r => JSON.stringify(r)).join(", ");

    const m = `*** secure-proxy *** [${now}] [${category}] - ${msg} ${r}`;

    if (this.debuggingMode) {
      console.log(m);
    }

    this.logMessages.push(m);
    while (this.logMessages.length > MAX_LOG_MESSAGES) {
      this.logMessages.shift();
    }
  }
}
