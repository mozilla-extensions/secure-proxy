export const constants = {
  isAndroid: false,

  async init() {
    const platformInfo = await browser.runtime.getPlatformInfo();
    this.isAndroid = platformInfo.os == "android";
  }
}

