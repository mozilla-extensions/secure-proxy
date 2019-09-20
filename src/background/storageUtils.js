export const StorageUtils = {
  async getProxyState() {
    return this.getStorageKey("proxyState");
  },

  async setProxyState(proxyState) {
    await browser.storage.local.set({proxyState});
  },

  async setAllTokenData(refreshTokenData, proxyTokenData, profileTokenData, profileData) {
    await browser.storage.local.set({
      refreshTokenData,
      proxyTokenData,
      profileTokenData,
      profileData,
    });
  },

  async resetAllTokenData() {
    await StorageUtils.setAllTokenData(null, null, null, null);
  },

  async setDynamicTokenData(proxyTokenData, profileTokenData, profileData) {
    await browser.storage.local.set({
      proxyTokenData,
      profileTokenData,
      profileData,
    });
  },

  async resetDynamicTokenData() {
    await browser.storage.local.set({
      proxyTokenData: null,
      profileTokenData: null,
      profileData: null,
    });
  },

  async getRefreshTokenData() {
    return this.getStorageKey("refreshTokenData");
  },

  async getProfileData() {
    return this.getStorageKey("profileData");
  },

  async getSurveyInitialTime() {
    return this.getStorageKey("surveyInitialTime");
  },

  async setSurveyInitialTime(surveyInitialTime) {
    await browser.storage.local.set({surveyInitialTime});
  },

  async getLastSurvey() {
    return this.getStorageKey("lastSurvey");
  },

  async setLastSurvey(lastSurvey) {
    await browser.storage.local.set({lastSurvey});
  },

  async getLastUsageDays() {
    return this.getStorageKey("lastUsageDays");
  },

  async setLastUsageDays(lastUsageDays) {
    await browser.storage.local.set({lastUsageDays});
  },

  async getFxaFlowParams() {
    return this.getStorageKey("fxaFlowParams");
  },

  async getStorageKey(key) {
    let data = await browser.storage.local.get([key]);
    return data[key];
  },

  async getMigrationData() {
    return this.getStorageKey("migrationData");
  },

  async setMigrationData(migrationData) {
    await browser.storage.local.set({migrationData});
  },
};
