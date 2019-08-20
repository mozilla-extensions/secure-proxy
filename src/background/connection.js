const CONNECTION_TIMEOUT = 20000; // 20 secs.

export class ConnectionTester {
  static run() {
    log("executing a fetch to check the connection");

    return new Promise((resolve, reject) => {
      setTimeout(_ => reject(), CONNECTION_TIMEOUT);

      fetch(CONNECTING_HTTP_REQUEST, { cache: "no-cache"}).
        then(r => {
          if (r.status === 200) {
            resolve();
            return;
          }

          reject();
        }, e => {
          log("ConnectionTester failed to fetch the resource", e);
          reject();
        });
    });
  }
}
