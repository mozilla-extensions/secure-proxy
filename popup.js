async function init() {
  const tabInfo = await browser.runtime.sendMessage({
    type: "tabInfo",
  });
  if (tabInfo && "proxied" in tabInfo) {
    setProxiedState(tabInfo.proxied)
  } else {
    setProxiedState(null)
  }

  let {enabledState} = await browser.storage.local.get(["enabledState"]) || true;

  const toggleProxy = document.getElementById("toggle-proxy");
  showButtonState(toggleProxy, enabledState);
  addActiveListener(toggleProxy, (e) => {
    enabledState = !enabledState;
    browser.storage.local.set({
      enabledState
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
