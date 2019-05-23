async function boop(options) {
  if (/^about:/.test(options.originUrl)) {
    return;
  }
  if (!/^firefox-container/.test(options.userContextId)) {
    return;
  }
  // Check we are in an unknown tab
  if (options.tabId !== -1) {
    // Request doesn't belong to a tab
  console.log("TR happened", options);
    return;
  }

  console.log("SW happened", options);

  return;
}

function init() {
  // In memory store of the state of current tabs
  const tabs = [];


  const PROXY_HOST = "127.0.0.1";
  const PROXY_PORT = 65535;

  function shouldProxyRequest(requestInfo) {
    console.log("should proxy", requestInfo);
    if (requestInfo.incognito == true) {
      return true;
    }
    return false;
  }

  function storeRequestState(decision, requestInfo) {
console.log("storing tab ingo", decision, requestInfo, tabs);
    if (!tabs[requestInfo.tabId]) {
      tabs[requestInfo.tabId] = {};
    }
    // TODO store something smater here for partial tab proxying etc
    if (!("proxied" in tabs[requestInfo.tabId])) {
      tabs[requestInfo.tabId].proxied = decision;
    // If we currently only have proxied resources and this isn't set false.
    } else if (tabs[requestInfo.tabId].proxied && !decision) {
      tabs[requestInfo.tabId].proxied = false;
    }
  }
/* TODO these looks like requests we should never proxy, decide on the best way to detect.
should proxy 
Object { requestId: "45", url: "https://safebrowsing.googleapis.com/v4/threatListUpdates:fetch?$ct=application/x-protobuf&key=AIzaSyC7jsptDS3am4tPx4r3nxis7IMjBc5Dovo&$httpMethod=POST&$req=ChUKE25hdmNsaWVudC1hdXRvLWZmb3gaCggFEAIiAiACKAE=", method: "GET", type: "other", fromCache: false, incognito: false, originUrl: undefined, documentUrl: undefined, frameId: 0, parentFrameId: -1, … }
background.js:37:13
should proxy 
Object { requestId: "46", url: "http://ocsp.pki.goog/GTSGIAG3", method: "POST", type: "other", fromCache: false, incognito: false, originUrl: undefined, documentUrl: undefined, frameId: 0, parentFrameId: -1, … }
background.js:37:13
should proxy 
Object { requestId: "47", url: "http://detectportal.firefox.com/success.txt", method: "GET", type: "xmlhttprequest", fromCache: false, incognito: false, originUrl: undefined, documentUrl: undefined, frameId: 0, parentFrameId: -1, … }
background.js:37:13
*/

  browser.proxy.onRequest.addListener((requestInfo) => {
    const decision = shouldProxyRequest(requestInfo);
    storeRequestState(decision, requestInfo);
    if (decision) {
      return {type: "http", host: PROXY_HOST, port: PROXY_PORT};
    }
    return {type: "direct"};
  }, {urls: ["<all_urls>"]});

  async function messageHandler(message, sender, response) {
console.log("a", message, sender, response);
    if (message.type == "tabInfo") {
      const tab = await browser.tabs.query({active: true, currentWindow: true});
console.log("got current selected", tab);
      return tabs[tab[0].id];
    }
    // dunno what this message is for
    return null;
  }

  browser.runtime.onMessage.addListener(messageHandler);

  // Add the request listener
  browser.webRequest.onBeforeRequest.addListener(boop, {urls: ["<all_urls>"], types: [
    "beacon",
    "csp_report",
    "font",
    "image",
    "imageset",
    "main_frame",
    "media",
    "object",
    "object_subrequest",
    "ping",
    "script",
    "speculative",
    "stylesheet",
    "sub_frame",
    "web_manifest",
    "websocket",
    "xbl",
    "xml_dtd",
    "xmlhttprequest",
    "xslt",
    "other",
  ]}, ["blocking"]);

  browser.webNavigation.onBeforeNavigate.addListener(
    (options) => {
      console.log("nav", options);
    },
  )
}

init();
