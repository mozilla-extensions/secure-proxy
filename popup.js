console.log(1);

async function handle() {
  const tabInfo = await browser.runtime.sendMessage({
    type: "tabInfo",
  });
  console.log("response", tabInfo);
  if (tabInfo && "proxied" in tabInfo) {
    setProxiedState(tabInfo.proxied)
  } else {
    setProxiedState(null)
  }
}

function setProxiedState(state) {
  let message = document.createElement("div");
  let stateName = "Not proxied";
  if (state) {
    stateName = "Proxied";
  } else if (state === null) {
    stateName = "Indeterminate";
  }
  message.textContent = `Proxy state: ${stateName}`;
  document.body.appendChild(message);
}

handle();
