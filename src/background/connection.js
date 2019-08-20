const CONNECTION_TIMEOUT = 20000; // 20 secs.

export class ConnectionTester {
  static run() {
    log("executing a fetch to check the connection");

    return new Promise((resolve, reject) => {
      setTimeout(_ => reject(), CONNECTION_TIMEOUT);

      // eslint-disable-next-line verify-await/check
      fetch(CONNECTING_HTTP_REQUEST, { cache: "no-cache"}).
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
    });
  }
}
