# Secure Proxy

An extension to enable a proxy within Firefox.

## How to install WebExtension

1. Install dependencies, `npm install && npm run build`
2. Build the add-on `npm run package`

## How to run WebExtension

1. `npm start`
2. This command uses `web-ext run` internally. Read [here](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext_run) how to change the default settings of web-ext.

## How to build WebExtension

1. `npm run package`
2. In about debugging browse to the dist/ directory

## Dependencies

- web-ext
- Latest nightly

## Documentation

- [PRD](https://docs.google.com/document/d/10JYO1KmRKaxV6_2zAevJmErKQg3IT6xeyOrdzJ8nDzE/edit#)
- [Smartsheet](https://app.smartsheet.com/sheets/GFMMPH62mqf2Pr23HxCV3GpCwppQH366vc2X8521?view=gantt)
- [Invision Overview](https://mozilla.invisionapp.com/share/P5RW39B4YB8#/365529699_extension-Overview)
- [Invision Basic Interaction](https://mozilla.invisionapp.com/share/GRSQXKXV4WZ)
- [Strings](https://docs.google.com/presentation/d/1HAR6BPWedFeIqz-GycavlzUOka1sgRgV0iwA9pcvtRw/edit#slide=id.p)
- [Scoping](https://docs.google.com/document/d/1e-RtTapqNXr3TRMCxFVIT2JPv9jea5B_GrZTDy2oEoA/edit)
- [FxA auth](https://docs.google.com/document/d/17_-TR4pD6zTy76jm88B1DFE-RNTWPC56yOB0C75XYqk/edit?ts=5ce6d7ad)
- [Browser VPN requirements](https://docs.google.com/document/d/17_-TR4pD6zTy76jm88B1DFE-RNTWPC56yOB0C75XYqk/edit?ts=5ce6d7ad)

## Contributing

See the [guidelines][contributing-link] for contributing to this project.

This project is governed by a [Code Of Conduct][coc-link].

To disclose potential a security vulnerability please see our [security][security-link] documentation.

## [License][license-link]

This module is licensed under the [Mozilla Public License, version 2.0][license-link].

[docs-link]: docs/
[contributing-link]: docs/contributing.md
[coc-link]: docs/code_of_conduct.md
[security-link]: docs/SECURITY.md
[license-link]: /LICENSE
