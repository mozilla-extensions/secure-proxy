import {Component} from "./component.js";
import {StorageUtils} from "./storageUtils.js";

export class ProxyStateObserver extends Component {
  setProxyState(proxyState) {
    super.setProxyState(proxyState);
    StorageUtils.setProxyState(proxyState);
  }
}
