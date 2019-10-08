const DEBUGGING_PROXY_URL = "https://proxy-staging.cloudflareclient.com:8001";
const PRODUCTION_PROXY_URL = "https://firefox.factor11.cloudflareclient.com:2486";

const DEBUGGING_FXA_OPENID = "https://stable.dev.lcip.org/.well-known/openid-configuration";
const PRODUCTION_FXA_OPENID = "https://accounts.firefox.com/.well-known/openid-configuration";

const DEBUGGING_SPS = "https://guardian-dev.herokuapp.com/";
const PRODUCTION_SPS = "https://fpn.firefox.com/";

class Page {
  constructor() {
    const els = [...document.querySelectorAll("[data-l10n]")];
    for (let el of els) {
      el.textContent = this.getTranslation(el.getAttribute("data-l10n"));
    }
  }

  async init() {
    let config = await browser.runtime.sendMessage({ type: "getCurrentConfig" });
    if (!config) config = {};

    const version = document.getElementById("version");
    if (config.version) {
      version.innerText = config.version;
    } else {
      version.innerText = this.getTranslation("olderThanV10");
      config.version = 0;
    }

    const passes = document.getElementById("passes");
    passes.innerText = config.currentPass + "/" + config.totalPasses;

    const reloadButton = document.getElementById("reload");
    reloadButton.onclick = _ => {
      browser.runtime.sendMessage({ type: "reload" });
    }
    if (config.version < 10) {
      reloadButton.disabled = true;
    }

    const clearButton = document.getElementById("clear");
    clearButton.onclick = _ => {
      browser.runtime.sendMessage({ type: "clear" });
    }
    if (config.version < 12) {
      clearButton.disabled = true;
    }

    const debuggingEnabled = document.getElementById("debuggingEnabled");
    debuggingEnabled.checked = config.debuggingEnabled || false;
    debuggingEnabled.onchange = _ => {
      browser.runtime.sendMessage({ type: "setDebuggingEnabled", value: debuggingEnabled.checked });
    }

    const migrationCompleted = document.getElementById("migrationCompleted");
    migrationCompleted.checked = config.migrationCompleted || false;
    migrationCompleted.onchange = _ => {
      browser.runtime.sendMessage({ type: "setMigrationCompleted", value: migrationCompleted.checked });
    }

    const proxyURL = document.getElementById("proxyURL");
    proxyURL.value = config.proxyURL || "";
    proxyURL.onchange = _ => {
      browser.runtime.sendMessage({ type: "setProxyURL", value: proxyURL.value });
    }
    if (config.version < 10) {
      proxyURL.disabled = true;
    }

    const debuggingProxyURL = document.getElementById("debuggingProxyURL");
    debuggingProxyURL.onclick = _ => {
      proxyURL.value = DEBUGGING_PROXY_URL;
      browser.runtime.sendMessage({ type: "setProxyURL", value: DEBUGGING_PROXY_URL });
    }

    const productionProxyURL = document.getElementById("productionProxyURL");
    productionProxyURL.onclick = _ => {
      proxyURL.value = PRODUCTION_PROXY_URL;
      browser.runtime.sendMessage({ type: "setProxyURL", value: PRODUCTION_PROXY_URL });
    }

    const sps = document.getElementById("sps");
    sps.value = config.sps || "";
    sps.onchange = _ => {
      browser.runtime.sendMessage({ type: "setSPService", value: sps.value });
    }
    if (config.version < 10) {
      sps.disabled = true;
    }

    const debuggingSPService = document.getElementById("debuggingSPService");
    debuggingSPService.onclick = _ => {
      sps.value = DEBUGGING_SPS;
      browser.runtime.sendMessage({ type: "setSPService", value: DEBUGGING_SPS });
    }

    const productionSPService = document.getElementById("productionSPService");
    productionSPService.onclick = _ => {
      sps.value = PRODUCTION_SPS;
      browser.runtime.sendMessage({ type: "setSPService", value: PRODUCTION_SPS });
    }

    const fxaOpenID = document.getElementById("fxaOpenID");
    fxaOpenID.value = config.fxaOpenID || "";
    fxaOpenID.onchange = _ => {
      browser.runtime.sendMessage({ type: "setFxaOpenID", value: fxaOpenID.value });
    }
    if (config.version < 10) {
      fxaOpenID.disabled = true;
    }

    const debuggingFxaOpenID = document.getElementById("debuggingFxaOpenID");
    debuggingFxaOpenID.onclick = _ => {
      fxaOpenID.value = DEBUGGING_FXA_OPENID;
      browser.runtime.sendMessage({ type: "setFxaOpenID", value: DEBUGGING_FXA_OPENID });
    }

    const productionFxaOpenID = document.getElementById("productionFxaOpenID");
    productionFxaOpenID.onclick = _ => {
      fxaOpenID.value = PRODUCTION_FXA_OPENID;
      browser.runtime.sendMessage({ type: "setFxaOpenID", value: PRODUCTION_FXA_OPENID });
    }

    const token = await browser.runtime.sendMessage({ type: "getProxyToken" });
    const proxyToken = document.getElementById("proxyToken");
    proxyToken.value = JSON.stringify(token);
    if (config.version < 10) {
      proxyToken.disabled = true;
    }

    const proxySubmitButton = document.getElementById("proxySubmit");
    proxySubmitButton.onclick = _ => {
      try {
        const value = JSON.parse(proxyToken.value);
        browser.runtime.sendMessage({ type: "setProxyToken", value });
      } catch (e) {
        alert("Syntax invalid: " + e);
      }
    }
    if (config.version < 10) {
      proxySubmitButton.disabled = true;
    }

    const passesTimeout = document.getElementById("passesTimeout");
    passesTimeout.value = config.passesTimeout;
    passesTimeout.onchange = _ => {
      browser.runtime.sendMessage({ type: "setPassesTimeout", value: passesTimeout.value });
    }
    if (config.version < 12) {
      passesTimeout.disabled = true;
    }

  }

  getTranslation(stringName, ...args) {
    if (args.length > 0) {
      return browser.i18n.getMessage(stringName, ...args);
    }
    return browser.i18n.getMessage(stringName);
  }
}

const p = new Page();
p.init();
