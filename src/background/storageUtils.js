export const StorageUtils = {
  async getProxyState() {
    return this.getStorageKey("proxyState");
  },

  async setProxyState(proxyState) {
    await browser.storage.local.set({proxyState});
  },

  async getStateTokenData() {
    return this.getStorageKey("stateTokenData");
  },

  async setStateTokenAndProfileData(stateTokenData, profileData) {
    await browser.storage.local.set({
      stateTokenData,
      proxyTokenData: null,
      profileData,
    });
  },

  async getProxyTokenData() {
    return this.getStorageKey("proxyTokenData");
  },

  async setProxyTokenData(proxyTokenData) {
    await browser.storage.local.set({proxyTokenData});
  },

  async setProxyTokenAndProfileData(proxyTokenData, profileData) {
    await browser.storage.local.set({
      proxyTokenData,
      profileData,
    });
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
};
