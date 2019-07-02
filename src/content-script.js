const ContentScript = {
  proxyEnabled: false,

  async init() {
    this.overwriteProperties();
    this.createPort();
  },

  createPort() {
    this.port = browser.runtime.connect({name:"port-from-cs"});
    this.port.onMessage.addListener(message => {
      if (message["type"] == "proxyState") {
        this.proxyEnabled = message["enabled"];
        return;
      }

      console.error("Invalid message: " + message);
    });
  },

  overwriteProperties() {
    const overwrittenProperties = new Set([
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName:"getSupportedConstraints", family: "webRTC", type: "method" },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName:"enumerateDevices", family: "webRTC", type: "method" },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName:"getUserMedia", family: "webRTC", type: "method" },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName:"getDisplayMedia", family: "webRTC", type: "method" },
      { originalMethod: null, parentObject: window, methodName:"RTCPeerConnection", family: "webRTC", type: "object" },
      { originalMethod: null, parentObject: window, methodName:"RTCIceCandidate", family: "webRTC", type: "object" },
      { originalMethod: null, parentObject: window, methodName:"RTCPeerConnectionStatic", family: "webRTC", type: "object" },
      { originalMethod: null, parentObject: window, methodName:"RTCSessionDescription", family: "webRTC", type: "object" },
    ]);

    overwrittenProperties.forEach(data => {
      if (!(data.methodName in data.parentObject.wrappedJSObject)) {
        return;
      }
      data.originalMethod = data.parentObject.wrappedJSObject[data.methodName];
      Object.defineProperty(data.parentObject.wrappedJSObject, data.methodName, {
       get: exportFunction(() => {
        if (this.proxyEnabled) {
          this.port.postMessage({type: data.family});
          if (data.type == "method") {
            return exportFunction(() => {
              return window.wrappedJSObject.Promise.reject(new window.wrappedJSObject.Error("SecurityError"));
            }, window);
          }

          if (data.type == "object") {
            throw new window.wrappedJSObject.Error("SecurityError");
          }
        }

        return data.originalMethod;
       }, window),

       set: exportFunction(function() {}, window),
      });
    });
  }
};

ContentScript.init();
