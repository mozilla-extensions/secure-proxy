import {Logger} from "./logger.js";

const log = Logger.logger("ConnectionTester");

const CONNECTION_TIMEOUT = 20000; // 20 secs.

export class ConnectionTester {
  static run(receiver) {
    log("executing a fetch to check the connection");

    const proxyListener = receiver.syncHandleEvent("proxyRequestCallback");

    let promise = new Promise((resolve, reject) => {
      setTimeout(_ => reject(), CONNECTION_TIMEOUT);

      // Make sure to go via the proxy for this and only this request
      browser.proxy.onRequest.addListener(proxyListener, {
        urls: [CONNECTING_HTTP_REQUEST]
      });
      log("added proxy.onRequest listener for", CONNECTING_HTTP_REQUEST);

      browser.experiments.proxyutils.checkConnection(CONNECTING_HTTP_REQUEST).
        then(() => {
            log("ConnectionTester succeeded to fetch the resource");
            resolve();
        }, () => {
          log("ConnectionTester failed to fetch the resource");
          reject();
        });
    });

    // Make sure we remove the proxy listener either the promise resolves or rejects

    promise.catch(_ => { }).then(_ => {
      browser.proxy.onRequest.removeListener(proxyListener);
      log("removed proxy.onRequest listener for", CONNECTING_HTTP_REQUEST);
    });

    return promise;
  }
}
