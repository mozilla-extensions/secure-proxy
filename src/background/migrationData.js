import {StorageUtils} from "./storageUtils.js";

const MIGRATION_TIMEOUT = 10000; // 10 secs

class MigrationData {
  async init() {
    this.migrationURL = await ConfigUtils.getMigrationURL();

    const migrationData = await StorageUtils.getMigrationData();
    if (migrationData) {
      await this.forceMigrationData(migrationData);
    }

    this.migrationReceivedAt = 0;

    this.syncResetTimeout();

    // Let's do a fetch immediately.
    // eslint-disable-next-line verify-await/check
    this.fetch();
  }

  syncResetTimers() {
    clearTimeout(this.timeoutId);
    this.timeoutId = 0;
    this.syncResetTimeout();
  }

  syncResetTimeout() {
    // Reset the timeout (in secs).
    this.timeout = 1;
  }

  syncScheduleFetch() {
    log("Scheduling the migration data download");
    this.timeoutId = setTimeout(async _ => this.fetch(), this.timeout * 1000);
  }

  async fetch() {
    clearTimeout(this.timeoutId);
    this.timeoutId = 0;

    if (await this.fetchInternal()) {
      // Duplicate the timeout for the next round.
      this.syncResetTimeout();
      return this.migrationData;
    }

    // Duplicate the timeout for the next round.
    this.timeout *= 2;

    this.syncScheduleFetch();
    return null;
  }

  async fetchInternal() {
    log("Fetching migration data");

    // eslint-disable-next-line verify-await/check
    let now = Date.now();
    let nowInSecs = Math.round(now / 1000);

    if ((this.migrationReceivedAt + MIGRATION_URL_TIME) > nowInSecs) {
      log("migration data cache is good");
      return true;
    }

    log("Fetching migration data for real");

    // Let's fetch the data with a timeout of FETCH_TIMEOUT milliseconds.
    let json;
    try {
      json = await Promise.race([
        fetch(this.migrationURL, {cache: "no-cache"}).then(r => r.json(), e => {
          console.error("Failed to fetch the migration resource", e);
          return null;
        }),
        new Promise(resolve => {
          setTimeout(_ => resolve(null), MIGRATION_TIMEOUT);
        }),
      ]);
    } catch (e) {
      console.error("Failed to fetch the migration resource", e);
    }

    if (!json) {
      return false;
    }

    return await this.forceMigrationData(json);
  }

  async forceMigrationData(json) {
    const fields = [ "expirationTime" ];
    for (let field in fields) {
      if (!(fields[field] in json)) {
        console.error(`Field ${fields[field]} required in the migration json!`);
        return false;
      }
    }

    // eslint-disable-next-line verify-await/check
    let now = Date.now();
    let nowInSecs = Math.round(now / 1000);

    this.migrationReceivedAt = nowInSecs;
    this.migrationData = json;

    // eslint-disable-next-line verify-await/check
    await StorageUtils.setMigrationData(json);

    log(`Migration data: ${JSON.stringify(json)}`);
    return true;
  }
}

export const migrationData = new MigrationData();
