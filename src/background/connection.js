const CONNECTION_TIMEOUT = 20000; // 20 secs.

export class ConnectionTester {
  static run(component) {
    log("executing a fetch to check the connection");

    return new Promise((resolve, reject) => {
      // Make sure to go through the proxy
      component.pushProxyRequestCallback();

      setTimeout(_ => reject(), CONNECTION_TIMEOUT);

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
    }).then(_ => {
      component.popProxyRequestCallback();
    }, _ => {
      component.popProxyRequestCallback();
    });
  }
}
