export class Component {
  constructor(receiver) {
    this.receiver = receiver;
    this.cachedProxyState = PROXY_STATE_LOADING;

    receiver.registerObserver(this);
  }

  // To overwrite, if needed.
  init() {}

  // Returns an async response from the main
  sendMessage(type, data = null) {
    return this.receiver.handleEvent(type, data);
  }

  // Returns a sync response from the main
  syncSendMessage(type, data = null) {
    return this.receiver.syncHandleEvent(type, data);
  }

  setProxyState(proxyState) {
    this.cachedProxyState = proxyState;
  }
}
