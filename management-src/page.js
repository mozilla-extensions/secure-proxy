const DEBUGGING_PROXY_URL = "https://proxy-staging.cloudflareclient.com:8001";
const PRODUCTION_PROXY_URL = "https://firefox.factor11.cloudflareclient.com:2486";

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

    const reloadButton = document.getElementById("reload");
    reloadButton.onclick = _ => {
      browser.runtime.sendMessage({ type: "reload" });
    }

    const debuggingEnabled = document.getElementById("debuggingEnabled");
    debuggingEnabled.checked = config.debuggingEnabled || false;
    debuggingEnabled.onchange = _ => {
      browser.runtime.sendMessage({ type: "setDebuggingEnabled", value: debuggingEnabled.checked });
    }

    const proxyURL = document.getElementById("proxyURL");
    proxyURL.value = config.proxyURL || "";
    proxyURL.onchange = _ => {
      browser.runtime.sendMessage({ type: "setProxyURL", value: proxyURL.value });
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

    const fxaExpirationTime = document.getElementById("fxaExpirationTime");
    fxaExpirationTime.value = config.fxaExpirationTime || 60;
    fxaExpirationTime.onchange = _ => {
      browser.runtime.sendMessage({ type: "setFxaExpirationTime", value: fxaExpirationTime.value });
    }

    const fxaExpirationDelta = document.getElementById("fxaExpirationDelta");
    fxaExpirationDelta.value = config.fxaExpirationDelta || 10;
    fxaExpirationDelta.onchange = _ => {
      browser.runtime.sendMessage({ type: "setFxaExpirationDelta", value: fxaExpirationDelta.value });
    }

    const tokens = await browser.runtime.sendMessage({ type: "getTokens" });

    const proxyToken = document.getElementById("proxyToken");
    proxyToken.value = JSON.stringify(tokens.proxy);

    const proxySubmitButton = document.getElementById("proxySubmit");
    proxySubmitButton.onclick = _ => {
      try {
        const value = JSON.parse(proxyToken.value);
        browser.runtime.sendMessage({ type: "setProxyToken", value });
      } catch (e) {
        alert("Syntax invalid: " + e);
      }
    }

    const profileToken = document.getElementById("profileToken");
    profileToken.value = JSON.stringify(tokens.profile);

    const profileSubmitButton = document.getElementById("profileSubmit");
    profileSubmitButton.onclick = _ => {
      try {
        const value = JSON.parse(profileToken.value);
        browser.runtime.sendMessage({ type: "setProfileToken", value });
      } catch (e) {
        alert("Syntax invalid: " + e);
      }
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
