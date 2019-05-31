async function init() {
  const tabInfo = await sendMessage("tabInfo");
  if (tabInfo && "proxied" in tabInfo) {
    setProxiedState(tabInfo.proxied)
  } else {
    setProxiedState(null)
  }

  let enabledState = await sendMessage("getEnabledState");

  const toggleProxy = document.getElementById("toggle-proxy");
  showProxyState(enabledState);
  addActiveListener(toggleProxy, async (e) => {
    enabledState = !enabledState;
    // Send a message to the background script to notify the enabledState has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    await sendMessage("setEnabledState", {enabledState});
    showProxyState(enabledState);
  });
}

async function sendMessage(type, data = {}) {
  return browser.runtime.sendMessage({
    type,
    data,
  });
}

// Show proxies current state, called whenever the user changes the proxy to be enabled/disabled
function showProxyState(state) {
  // Change the current state text of the toggle button
  const toggleProxy = document.getElementById("toggle-proxy");
  toggleProxy.textContent = state ? "Disable Proxy" : "Enable Proxy";
}

function addActiveListener(el, listener) {
  el.addEventListener("click", listener);
  el.addEventListener("submit", listener);
}

function setProxiedState(state) {
  let stateName = "Not proxied";
  if (state) {
    stateName = "Proxied";
  } else if (state === null) {
    stateName = "Indeterminate";
  }
  const message = document.getElementById("state");
  message.textContent = `Proxy state: ${stateName}`;
}

init();
