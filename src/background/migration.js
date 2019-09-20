import {Component} from "./component.js";
import {migrationData} from "./migrationData.js";
import {Tier} from "./tier.js";

const TIER_ENDPOINT_URLS = [
 // [ URL, redirect to ]
 [ "https://private-network.firefox.com/free-tier-enabled-install", "https://private-network.firefox.com/free-tier-enabled" ],
 [ "https://private-network.firefox.com/subscription-completed-install", "https://private-network.firefox.com/subscription-completed" ],
];

// This component handles the migration from beta to the paid version.
export class Migration extends Component {
  constructor(receiver) {
    super(receiver);
  }

  async init() {
    // We fetch migration data only if the decision has not been made yet.
    const tier = await Tier.userTier();
    log(`Migration tier status: ${tier}`);
    if (tier === TIER_UNKNOWN) {
      await migrationData.init();

      const handler = details => {
        // eslint-disable-next-line verify-await/check
        browser.webRequest.onBeforeRequest.removeListener(handler);
        this.syncDecisionMade(details);
      };

      // eslint-disable-next-line verify-await/check
      const monitoredURLs = TIER_ENDPOINT_URLS.map(urls => urls[0]);

      // eslint-disable-next-line verify-await/check
      browser.webRequest.onBeforeRequest.addListener(handler,
        {types: ["main_frame"], urls: monitoredURLs});
    }
  }

  setProxyState(proxyState) {
    super.setProxyState(proxyState);

    migrationData.syncResetTimers();

    // No await here!
    // eslint-disable-next-line verify-await/check
    this.maybeShowDecision();
  }

  syncIsInterestingProxyState() {
    return [ PROXY_STATE_INACTIVE,
             PROXY_STATE_ACTIVE,
             PROXY_STATE_CONNECTING ].includes(this.cachedProxyState);
  }

  // Force the decision proxy state if needed.
  async maybeShowDecision() {
    if (!this.syncIsInterestingProxyState()) {
      return;
    }

    let required = await this.betaDecisionRequired();
    log(`Beta decision required: ${required}`);

    if (required) {
      await this.sendMessage("betaDecisionRequired");
      return;
    }

    let data = await migrationData.fetch();
    if (!data) {
      return;
    }

    // Let's wait the diff, or max the expiration time. In this way, we refresh
    // the migration URL automatically.

    // eslint-disable-next-line verify-await/check
    let now = Math.round(Date.now() / 1000);
    let diff = data.expirationTime - now;

    let minDiff = Math.min(MIGRATION_URL_TIME, diff);
    setTimeout(_ => this.maybeShowDecision(), minDiff * 1000);
  }

  async betaDecisionRequired() {
    const tier = await Tier.userTier();
    if (tier !== TIER_UNKNOWN) {
      return false;
    }

    let data = await migrationData.fetch();
    if (data === null) {
      return false;
    }

    // eslint-disable-next-line verify-await/check
    let now = Math.round(Date.now() / 1000);
    let diff = data.expirationTime - now;

    return diff <= 0;
  }

  syncDecisionMade(details) {
    // eslint-disable-next-line verify-await/check
    const redirect = TIER_ENDPOINT_URLS.find(data => details.url.startsWith(data[0]));
    if (!redirect) {
      // What is going on? We should find this URL!
      return;
    }

    // Let's redirect to the the non-download version of this page.
    // eslint-disable-next-line verify-await/check
    browser.tabs.update(details.tabId, {url: redirect[1]});

    // This triggers a new profile request. We should fine the correct state.
    // eslint-disable-next-line verify-await/check
    this.sendMessage("betaDecisionMade");
  }

  async forceMigrationData(data) {
    await migrationData.forceMigrationData(data);
  }
}
