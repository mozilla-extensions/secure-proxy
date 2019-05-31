async function init() {
  const tabInfo = await browser.runtime.sendMessage({
    type: "tabInfo",
  });
  if (tabInfo && "proxied" in tabInfo) {
    setProxiedState(tabInfo.proxied)
  } else {
    setProxiedState(null)
  }

  // TODO make this message pass to the background script so we don't block per request on storage access.
  let {enabledState} = await browser.storage.local.get(["enabledState"]);

  const toggleProxy = document.getElementById("toggle-proxy");
  showButtonState(toggleProxy, enabledState);
  addActiveListener(toggleProxy, async (e) => {
    enabledState = !enabledState;
    browser.storage.local.set({
      enabledState
    });
    // Send a message to the background script to notify the enabledState has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    await browser.runtime.sendMessage({
      type: "enabledState",
      value: enabledState,
    });
    showButtonState(toggleProxy, enabledState);
  });
}

function showButtonState(el, state) {
  el.textContent = state ? "Disable Proxy" : "Enable Proxy";
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
