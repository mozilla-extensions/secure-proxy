/* eslint-disable-next-line no-unused-vars */
class Component {
  constructor(receiver) {
    this.receiver = receiver;
    this.cachedProxyState = PROXY_STATE_LOADING;

    // eslint-disable-next-line verify-await/check
    receiver.registerObserver(this);
  }

  // Returns a potentially async response from the background
  sendMessage(type, data = null) {
    return this.receiver.handleEvent(type, data);
  }

  setProxyState(proxyState) {
    this.cachedProxyState = proxyState;
  }
}
