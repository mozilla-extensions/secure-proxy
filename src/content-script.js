/* global exportFunction */

const ContentScript = {
  proxyEnabled: false,

  async init() {
    this.createPort();
    this.overwriteProperties();
  },

  createPort() {
    this.port = browser.runtime.connect({ name:"port-from-cs" });
    this.port.onMessage.addListener(message => {
      if (message.type === "proxyState") {
        this.proxyEnabled = message.enabled;
        return;
      }

      console.error("Invalid message: " + message);
    });
  },

  overwriteProperties() {
    const overwrittenProperties = new Set([
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "getSupportedConstraints", type: "method" },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "enumerateDevices", type: "method" },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "getUserMedia", type: "method" },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "getDisplayMedia", type: "method" },
      { originalMethod: null, parentObject: window, methodName: "RTCPeerConnection", type: "object" },
      { originalMethod: null, parentObject: window, methodName: "RTCIceCandidate", type: "object" },
      { originalMethod: null, parentObject: window, methodName: "RTCPeerConnectionStatic", type: "object" },
      { originalMethod: null, parentObject: window, methodName: "RTCSessionDescription", type: "object" },
    ]);

    overwrittenProperties.forEach(data => {
      if (!(data.methodName in data.parentObject.wrappedJSObject)) {
        return;
      }

      data.originalMethod = data.parentObject.wrappedJSObject[data.methodName];
      Object.defineProperty(data.parentObject.wrappedJSObject, data.methodName, {
       get: exportFunction(() => {
        if (this.proxyEnabled) {
          if (data.type === "method") {
            return exportFunction(() => {
              return window.wrappedJSObject.Promise.reject(new window.wrappedJSObject.Error("SecurityError"));
            }, window);
          }

          if (data.type === "object") {
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
