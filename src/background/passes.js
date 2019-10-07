import {Component} from "./component.js";

// How often we check if we have new passes.
const CHECK_NEW_PASSES_TIMEOUT = 21600; // 6 hours

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
  }

  async init() {
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

    if (this.currentPass < currentPass) {
      this.passRequested = false;
    }

    this.migrationCompleted = true;
    await browser.storage.local.set({migrationCompleted: true});

    this.currentPass = currentPass;
    this.totalPasses = totalPasses;

    await browser.storage.local.set({currentPass, totalPasses});

    if (!oldMigrationCompleted || this.currentPass === this.totalPasses) {
      // We don't want to wait here. We would create a dead-lock.
      // eslint-disable-next-line verify-await/check
      this.sendMessage("pass-available", {firstMigration: !oldMigrationCompleted });
    }

    this.syncSchedulePassCheck();
  }

  syncSchedulePassCheck() {
    const now = new Date();
    // eslint-disable-next-line verify-await/check
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1);
    const diff = Math.min(CHECK_NEW_PASSES_TIMEOUT, firstOfNextMonth - now);

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
}
