/* eslint-disable-next-line no-unused-vars */
class Component {
  constructor(receiver) {
    this.receiver = receiver;
    this.cachedProxyState = PROXY_STATE_LOADING;

    receiver.registerObserver(this);
  }

  sendMessage(type, data = null) {
    return this.receiver.handleEvent(type, data);
  }

  setProxyState(proxyState) {
    this.cachedProxyState = proxyState;
  }
}
