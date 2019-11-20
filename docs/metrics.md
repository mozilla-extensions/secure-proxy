# Secure-Proxy telemetry events

_Last Updated: Aug 28, 2019_

<!-- TOC depthFrom:2 depthTo:6 withLinks:1 updateOnSave:1 orderedList:0 -->

- [Analysis](#analysis)
- [Collection](#collection)
	- [Event Registration and Recording](#event-registration-and-recording)
	- [Scalar Registration and Recording](#scalar-registration-and-recording)
- [List of Planned Metrics Events](#list-of-planned-metrics-events)
- [List of Planned Metrics Scalars](#list-of-planned-metrics-scalars)
- [References](#references)

<!-- /TOC -->

This is the metrics collection plan for Secure-Proxy. It documents all events currently collected through telemetry, as well those planned for collection but not currently implemented. It will be updated periodically to reflect all new and planned data collection.

## Analysis

Data collection is done solely for the purpose of product development, improvement and maintenance.

The data collection outlined here is geared toward answering the following questions (see [List of Implemented Events](#list-of-planned-metrics-events)):


* Is the current user-interface good enough?
  * Is the panel opened?
  * Is the settings page visible enough?
  * What's the most important URL in the settings page?
  * Do the users manage their accounts through the settings page?
  * What's the most common way to disable/enable the proxy?
* How often we have proxy errors. In particular we care about these errors:
  * The extension is sending an invalid token
  * The proxy endpoint reports an user abuse
  * The proxy seems to be down
* How often we have authentication errors. In particular we care about:
  * How often the user starts the authentication flow
  * How often the authentication flow succeeds and how often it fails.
* Is the webRTC-disabling message good enough?
  * Is this feature used by the user to exempt tabs?
* What is the amount of bandwidth consumed when the proxy is in use?

## Collection

To record Telemetry we will be making use of the public JavaScript API that allows recording and sending of [events](https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/telemetry/collection/events.html#public-js-api).

Once telemetry is logged on the measurements should appear in [about:telemetry](about:telemetry). From there they will be submitted in the "event" ping payload under `processes.dynamic.events` and available through the usual services (STMO), as well as amplitude (eventually).

### Event Registration and Recording

The events that we will record will conform to the structure expected by the telemetry pipeline. When the events are logged in telemetry they will be a list of:

`[timestamp, category, method, object, value, extra]`

The API takes care of the timestamp for us. We just need to define `category`, `method` and `object`. `value` is optional and it's used only for some objects.

Events are defined by **registering** them using a call to `browser.telemetry.registerEvents(category, eventData)`.

Here's a breakdown of how a to register a typical event:


```javascript
browser.telemetry.registerEvents("eventcategory", {
    "eventName": {
        methods: ["click", ... ], // types of events that can occur
        objects: ["aButton", ... ], // objects event can occur on
        extra: {"key": "value", ... } // key-value pairs (strings)
    }
```

Once an event is registered, we can record it with: (\*)

`browser.telemetry.recordEvent(category, method, object, value, extra)`

Note: The semantics of `value` is contingent on the event being recorded, see list below.

## List of Planned Events

All events are currently implemented under the **category: secure.proxy**.
If not specified differently, **value** is passed as null.

The **methods** are:

1. `general` fires when the extension detects a generic operation/error. **objects**:
   1. `otherProxyInUse`: another proxy setting has been detected.
   1. `settingsShown`: the settings view is shown.
   1. `loadingError`: the loading of the panel fails (this is based on a timer)
   1. `install`: the extension has been installed. **value**: the version number.
   1. `update`: the extension has been updated. **value**: the version number.
   1. `panelShown`: the proxy panel has been opened.
1. `fxa` fires when there are authentication events. **objects**:
   1. `authStarted`: the user has started the authentication flow.
   1. `authCompleted`: the user has completed the authentication flow.
   1. `authFailed`: the authentication flow has terminated with an error.
   1. `authFailedByGeo`: the authentication flow has terminated with an geo-restriction error.
1. `networking` fires when there is a proxy network error. **objects**:
   1. `407`: a 407 error code has been received. This error is received when the proxy receives an invalid/expired token.
   1. `429`: the proxy returns 429 when the user is abusing of the service. The concept of "abuse" has not been defined yet.
   1. `connecting`: the proxy is unreachable during the connecting phase.
   1. `proxyDown`: the proxy seems unreachable.
1. `state` fires when the proxy state changes
   1. `proxyEnabled`: the proxy is enabled by user-interaction. **value**: toggleButton or stateButton. **extra**: passes, with the number of consumed passes
   1. `proxyDisabled`: the proxy is disabled by user-interaction. **value**: toggleButton or stateButton. **extra**: passes, with the number of consumed passes
1. `settings_url_clicks` fires when the user interacts with the settings view. **objects**:
   1. `manageAccount`: the user clicks on the manage account URL.
   1. `helpAndSupport`: the user clicks on the help & support URL.
   1. `cloudflare`: the user clicks on the Cloudflare URL.
   1. `privacyPolicy`: the user clicks on privacy & policy URL.
   1. `termsAndConditions`: the user clicks on terms & conditions URL.
   1. `giveUsFeedback`: the user clicks on give-us-a-feedback URL
1. `settings` fires when the user changes some of settings. **objects**:
   1. `setReminder`: the reminder setting has changed.
   1. `setAutoRenew`: the auto-renew setting has changed.
1. `webRTC` fires when the user interacts with the webRTC dialog in-content. **objects**:
   1. `ignoreTab`: the user has decided to keep the proxy on for this tab.
   1. `exemptTab`: the user has decided to disable the proxy for this tab.


### scalar Registration and Recording

About how to register scalars, see https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/collection/scalars.html

## List of Planned Scalars

All scalars are currently implemented under the **category: secure.proxy**.

The **scalars** are:

1. `bandwidth` contains the amount of kbytes sent and received when the proxy is in use.


---

## References

Docs for the Mozilla privileged JS API that allows us to log events thru an add-on:

[Telemetry Public JS API](https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/telemetry/collection/events.html#the-api)
