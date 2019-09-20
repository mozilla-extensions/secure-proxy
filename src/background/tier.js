import {StorageUtils} from "./storageUtils.js";

export class Tier {
  static async userTier() {
    let profileData = await StorageUtils.getProfileData();
    if (!profileData) {
      return TIER_UNKNOWN;
    }

    // Already subscribed!
    if (profileData.subscriptions && profileData.subscriptions.length !== 0) {
      await StorageUtils.setUserTier(TIER_PAID);
      return TIER_PAID;
    }

    // TODO: how to detect the free tier?

    return TIER_UNKNOWN;
  }
}
