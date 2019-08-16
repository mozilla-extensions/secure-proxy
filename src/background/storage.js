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

  async getSurveyInitTime() {
    return this.getStorageKey("surveyInitTime");
  },

  async setSurveyInitTime(surveyInitTime) {
    await browser.storage.local.set({surveyInitTime});
  },

  async getLastSurvey() {
    return this.getStorageKey("lastSurvey");
  },

  async setLastSurvey(lastSurvey) {
    await browser.storage.local.set({lastSurvey});
  },

  async getStorageKey(key) {
    let data = await browser.storage.local.get([key]);
    return data[key];
  }
};
