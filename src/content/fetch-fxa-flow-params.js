// these three keys help FxA track users from an entrypoint
// through a conversion funnel.
// For the best possible understanding of our flow, we fetch
// these keys from the firefox private network site
const REQUIRED_KEYS = ["deviceId", "flowBeginTime", "flowId"];

async function getFxaFlowFromSite() {
  return window.localStorage.getItem("flowInfo");
}

// set params to storage if valid
async function setFxaFlowParams(data) {
  const fxaFlowParams = await parse(data);
  if (await validate(fxaFlowParams)) {
    await browser.storage.local.set({fxaFlowParams});
  }
}

async function parse(data) {
  return JSON.parse(data);
}

// validate everything by making sure
// all of the required keys are present
async function validate(data) {
  return REQUIRED_KEYS.every(key => {
    return Object.prototype.hasOwnProperty.call(data, key);
  });
}

getFxaFlowFromSite().then(res => setFxaFlowParams(res));
