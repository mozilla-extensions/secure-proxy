import {Component} from "./component.js";

export class MobileEvents extends Component {
    async init() {
        console.log("Creating port to mozacSecureProxy")
        let port = browser.runtime.connectNative("mozacSecureProxy");
        port.onMessage.addListener((message) => {
            switch (message.action) {
              case 'sendCode':
                console.log(`Received sendCode`);
                let statusCode = message.statusCode
                let authCode = message.authCode
                this.sendMessage("sendCode", {statusCode, authCode});
                break;
              case 'disableProxy':
                console.log(`Received disableProxy`)
                this.sendMessage("enableProxy", {enabledState: false, reason: "toggleButton"});
                // reason is a NOOP as mobile uses its own telemetry
                break;
              case 'enableProxy':
                console.log(`Received enableProxy`)
                this.sendMessage("enableProxy", {enabledState: true, reason: "toggleButton"})
                // reason is a NOOP as mobile uses its own telemetry
                break;
              default:
                console.error(`Received invalid action ${message.action}`);
            }
        });
    }
}
