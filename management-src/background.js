const EXTENSION_ID = "secure-proxy@mozilla.com";
function sendMessage(type, value) {
  return browser.runtime.sendMessage(
    EXTENSION_ID,
    { type, value }
  );
}
async function init() {
  let result = await sendMessage("getCurrentConfig");
  console.log(result);
  sendMessage("setDebuggingEnabled", true);
}
init();
