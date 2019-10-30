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

    const {migrationCompleted} = await browser.storage.local.get("migrationCompleted");
    this.migrationCompleted = migrationCompleted;

    const {currentPass} = await browser.storage.local.get("currentPass");
    this.currentPass = currentPass;

    const {totalPasses} = await browser.storage.local.get("totalPasses");
    this.totalPasses = totalPasses;

    this.syncSchedulePassCheck();
  }

  syncIsMigrationCompleted() {
    return this.migrationCompleted;
  }

  syncAreUnlimited() {
    return this.totalPasses === -1;
  }

  syncGetPasses() {
    return {
      currentPass: this.currentPass,
      totalPasses: this.totalPasses,
    };
  }

  async setPasses(currentPass, totalPasses) {
    log(`Storing passes current: ${currentPass} - total: ${totalPasses}`);

    const oldMigrationCompleted = this.migrationCompleted;
    const oldAvailability = this.totalPasses - this.currentPass;

    if (this.currentPass < currentPass) {
      this.passRequested = false;
    }

    this.migrationCompleted = true;
    await browser.storage.local.set({migrationCompleted: true});

    this.currentPass = currentPass;
    this.totalPasses = totalPasses;

    await browser.storage.local.set({currentPass, totalPasses});

    const availability = this.totalPasses - this.currentPass;

    log(`Current availability: ${availability} - old availability: ${oldAvailability}`);

    if (!oldMigrationCompleted || availability > oldAvailability) {
      // We don't want to wait here. We would create a dead-lock.
      // eslint-disable-next-line verify-await/check
      this.sendMessage("pass-available", {firstMigration: !oldMigrationCompleted });
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
