import {Component} from "./component.js";

let self;

export class Passes extends Component {
  static syncGet() {
    return self;
  }

  constructor(receiver) {
    super(receiver);

    this.passRequested = false;
    this.nextMonthTimer = 0;

    self = this;

    browser.runtime.onInstalled.addListener(async details => this.onInstalled(details));
  }

  async init() {
    // In msecs.
    this.passesTimeoutMs = (await ConfigUtils.getPassesTimeout()) * 1000;

    const {currentPass} = await browser.storage.local.get("currentPass");
    this.currentPass = currentPass;

    const {totalPasses} = await browser.storage.local.get("totalPasses");
    this.totalPasses = totalPasses;

    this.syncSchedulePassCheck();
  }

  syncAreUnlimited() {
    return this.totalPasses === undefined || this.totalPasses === -1;
  }

  syncGetPasses() {
    return {
      currentPass: this.currentPass,
      totalPasses: this.totalPasses,
    };
  }

  async setPasses(currentPass, totalPasses) {
    log(`Storing passes current: ${currentPass} - total: ${totalPasses}`);

    let oldAvailability;
    // First activation of secure-proxy.
    if (this.totalPasses === undefined) {
      oldAvailability = -1;
    } else {
      oldAvailability = this.totalPasses - this.currentPass;
    }

    this.currentPass = currentPass;
    this.totalPasses = totalPasses;
    this.passRequested = false;

    await browser.storage.local.set({currentPass, totalPasses});

    let availability = -1;
    if (this.totalPasses !== -1) {
      availability = this.totalPasses - this.currentPass;
    }

    log(`Current availability: ${availability} - old availability: ${oldAvailability}`);

    if (availability > oldAvailability) {
      // We don't want to wait here. We would create a dead-lock.
      // eslint-disable-next-line verify-await/check
      this.sendMessage("pass-available");
    }

    this.syncSchedulePassCheck();
  }

  syncSchedulePassCheck() {
    log("Scheduling the pass check");

    const now = new Date();
    // eslint-disable-next-line verify-await/check
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1);
    const diff = Math.min(this.passesTimeoutMs, firstOfNextMonth - now);

    clearTimeout(this.nextMonthTimer);
    this.nextMonthTimer = setTimeout(_ => this.checkNewPasses(), diff);
  }

  syncPassNeeded() {
    log("Pass needed!");

    if (!this.passRequested) {
      this.passRequested = true;

      // No wait here!
      // eslint-disable-next-line verify-await/check
      this.sendMessage("pass-needed");
    }
  }

  async checkNewPasses() {
    log("Check new passes");
    await this.sendMessage("pass-availability-check");
  }

  async onInstalled(details) {
    if (details.reason !== "update") {
      return;
    }

    // eslint-disable-next-line verify-await/check
    if (parseInt(details.previousVersion) >= 15) {
      return;
    }

    log("Force a new authentication for un update");
    await this.sendMessage("authenticationNeeded");
  }
}
