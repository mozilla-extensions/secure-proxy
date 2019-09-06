const CONNECTION_TIMEOUT = 20000; // 20 secs.

export class ConnectionTester {
  static run(receiver) {
    log("executing a fetch to check the connection");

    const proxyListener = receiver.net.newProxyRequestCallback();
    const removeProxyListener = _ => {
      browser.proxy.onRequest.removeListener(proxyListener);
      log("removed proxy.onRequest listener for", CONNECTING_HTTP_REQUEST);
    };

    return new Promise((resolve, reject) => {
      setTimeout(_ => reject(), CONNECTION_TIMEOUT);

      // Make sure to go via the proxy for this request
      browser.proxy.onRequest.addListener(proxyListener, {
        urls: [CONNECTING_HTTP_REQUEST]
      });
      log("added proxy.onRequest listener for", CONNECTING_HTTP_REQUEST);

      // eslint-disable-next-line verify-await/check
      fetch(CONNECTING_HTTP_REQUEST, { cache: "no-cache" }).
        then(r => {
          if (r.status === 200) {
            // eslint-disable-next-line verify-await/check
            resolve();
            return;
          }

          // eslint-disable-next-line verify-await/check
          reject();
        }, e => {
          log("ConnectionTester failed to fetch the resource", e);
          // eslint-disable-next-line verify-await/check
          reject();
        });
    }).then(removeProxyListener, removeProxyListener);
  }
}
