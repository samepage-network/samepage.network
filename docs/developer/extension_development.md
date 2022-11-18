---
title: Extension Development
description: In-depth guide on how to create a SamePage-compatible extension
---

Developing a SamePage extension is made far easier by use of the `samepage` NPM package. It helps aid in developer productivity and uniformity across extensions.

At any point in this guide, developers could instead feel free to swap out an individual method with a custom implementation of the protocol. If you choose to do so, we would appreciate a GitHub issue opened on the [monorepo](https://github.com/samepage-network/samepage.network/issues) explaining how the supported packages fell short.

The packages aims for a philosophy of "smart defaults, yet extendable". Most parameters to most methods are optional so that differences within individual tools for thought could override them. The package requires importing methods **directly** so that tree shaking is made possible and we are sending the least amount of code possible to users. For example, instead of:

```typescript
import { setupSamePageClient } from "samepage";
```

we require:

```typescript
import setupSamePageClient from "samepage/protocols/setupSamePageClient";
```

Most extensions should only need the `samepage` NPM package. However, it could be useful to only install a subset of the package, say if you are developing a build tool or a component library for the tool you're targeting. For this case, the `NPM` package is also published as a series of scoped `@samepage` packages which are each individually installable. To use, the same imports as before should work by simply adding the `@` in front of the module name. So for example, instead of:

```typescript
import build from "samepage/scripts/build";
```

we also support:

```typescript
import build from "@samepage/scripts/build";
```

Throughout this guide, we would encourage referencing the extension implementation of existing supported clients as examples on how each application interacts with SamePage.

## Architecture of an extension

All extensions should have the following file structure:

- `.github/workflows` - One action called `main.yaml`, which watches for changes on the `main` branch and publishes the newest version of the extension to SamePage and the relevant tool's extension store. A second called `test.yaml` which runs tests on changes in the `main` branch and on PR branches.
- `src` - The directory containing all of the source code for the extension
- `test` - The directory containing all of the tests for the extension
- `.gitignore` - Standard ignore file
- `LICENSE` - Must be MIT
- `README.md` - Docs for using the extension on the relevant tool
- `package-lock.json` - Auto generated after install
- `package.json` - Should contain scripts for `start` and `test`, as well as have the latest version of `samepage` as a package dependency.
- `tsconfig.json` - Configuration for building the extension. We require our extensions to be in TypeScript.

Extensions are expected to run on the browser or anything that supports browser APIs (e.g. electron).

## Implementing the protocol

A SamePage-compatible extension needs to handle four parts:

- Decide where to store and display user settings
- Setting up the SamePage client
- Setting up all of the _protocols_ the extension wants to support
- Have a way to call all of the unload methods produced from above

These four pieces usually take place at the entry point file of the extension. We will break down what each of these entails below.

### User Settings

Tools for thought typically will designate an area for users to configure their extension's settings. We expose the default list of settings that SamePage extensions are expected to implement:

- `uuid` - The Notebook Universal ID that represents the user's notebook.
- `token` - The Notebook Token that authenticates the notebook to the network.

Extensions are free to configure additional settings on top of this set, but these are the base requirement. These settings must be persisted between sessions so that their value is retained when the user reloads the host app. To ease in configuring these settings, look to import the `defaultSettings` object from the `utils` module:

```typescript
import defaultSettings from "samepage/utils/defaultSettings";

const settings = defaultSettings.map((d) => ({
    id: d.id,                   // string
    name: d.name,               // string
    description: d.description, // string
    value: d.default            // boolean or string
    type: d.type                // "boolean" or "string"
}))
```

### Setup Client

The SamePage Client is a `WebSocket` client that connects to SamePage's WebSocket API Gateway. It should register the host app's Notebook properties (the application id and the workspace name), know how to receive user commands, and how to interact with the user settings from above. The `protocols` module exposes a strongly typed `setupSamePageClient` method to help guide developers on all of the pieces needed to setup the client. All fields are optional with some basic defaults, though the developer should overwrite the following fields below:

```typescript
import setupSamePageClient from "samepage/protocols/setupSamePageClient";

const { unload, ...globalAPI } = setupSamePageClient({
  // Notebook properties
  app: "Roam",
  workspace: "dvargas92495",

  // Interact with settings
  getSetting: (s) => localStorage.getItem(s),
  setSetting: (s, v) => localStorage.setItem(s, v),

  // Interact with user
  addCommand: window.roamAlphaAPI.ui.commandPalette.addCommand,
  removeCommand: window.roamAlphaAPI.ui.commandPalette.removeCommand,
});
```

The setup method returns an `unload` prop, and a set of methods that make up the [Global API](./global_api.md). It also accepts a few other properties aimed at smoothing out differences between apps. For those, please consult the full [NPM API](./npm_api.md). This method will also attach some WebSocket listeners so that it's ready to accept data.

### Setup Protocols

Once the client is setup, we could start adding bundles of functionality we refer to as _protocols_. A protocol in this context means the series of both notebook listeners and DOM listeners that work towards a common goal. You will want to setup all of your protocols after setting up the client and return the unload methods for the final phase below.

SamePage comes out of the box with one protocol implemented: the _Share Page_ protocol. This is what allows users to live sync pages across applications. You can feel free to add additional protocols that are either unique to your host application or could be great additions to SamePage broadly in the future. Typically you should call each individual protocol's unload in the reverse order as they were set up.

```typescript
const setupProtocols = () => {
  const unloadSharePageWithNotebook = setupSharePageWithNotebook();
  const unloadToolSpecificProtocol = setupToolSpecificProtocol();
  // add more here
  return () => {
    unloadToolSpecificProtocol();
    unloadSharePageWithNotebook();
  };
};
```

To help implement the native _Share Page_ protocol, the `samepage` package exports a method called `setupSharePageWithNotebook` from the `protocols` module.

```typescript
const setupSharePageWithNotebook = () => {
  const { unload } = loadSharePageWithNotebook({
    getCurrentNotebookPageId,
    createPage,
    openPage,
    deletePage,
    applyState,
    calculateState,
    overlayProps,
  });

  return unload;
};
```

To learn more about how to implement each of these properties of the protocol, checkout out our guide on the [Share Page Protocol](./share_page_protocol.md).

### Cleanup on Unload

Towards the end of the extension entry file, you should register the cleanup functions returned by the protocols outlined above (including the client's setup) to the host application's unload handler. This not only speeds up development by not requiring an entire refesh of the host application, but it also will mostly be required for review as to not leave hanging state for other extensions to discover.

No helper function from `samepage`. Simply call the exit-related functions in the same onunload callback. In an ideal world, your entry file should then look like this:

```typescript
setupUserSettings();
const unloadClient = setupClient();
const unloadProtocols = setupProtocols();
return () => {
  unloadProtocols();
  unloadClient();
};
```

## Dev Environment

The `samepage` NPM package also comes with it a suite of tools that help developers create, maintain, test, and publish their extensions. These tools are available as a binary to be executed as `samepage [method]` from a `package.json` script or `npx samepage [method]` from the command line. They could also be invoked from a script and are located within the `scripts` module.

### TypeScript

All the build tools assume the extensions are written in [TypeScript](https://www.typescriptlang.org/) by default. The entry point should be top level within the `src` directory and is typically named `index.ts`, though this could differ depending on the host application's conventions for loading extensions.

### Styling

Coming soon...

### Standard Arguments

There are four commands that make up the development environment:
- `dev`
- `test`
- `build`
- `publish`

The first three of these commands all support the same set of base arguments, which get forwarded to the SamePage extension compiler. They are all optional.

- `external` - List of modules that should **not** be bundled into the output, in the case the host application is already exposing it. Use `module=window.module` to specify what the replacement could be. **Default:** _None_
- `include` - List of files to include in the output package. **Default:** _None_
- `css` - Bundle all the output CSS files into one, denoted by this value. **Default:** _None_
- `format` - The output format for the generated JavaScript files. See the `esbuild` [docs](https://esbuild.github.io/api/#format) for more. **Default:** _iife_
- `mirror` - A directory to mirror the output of the compiler. **Default:** _None_
- `env` - A list of environment variables that should be interpolated into the package's output. **Default:** _None_
- `analyze` - Set to true to output a metadata file to analyze the extension's bundle size and dependencies. **Default:** _false_
- `finish` - File path to a file with a custom function default exported that runs at the end of compilation. **Default:** _None_
- `out` - The filename the extension's entrypoint JavaScript file and CSS file are out as. **Default:** Same as input.

On the command line, all flags are specified with a `--` prefix. A flag with no value after it is treated as a boolean. A flag repeated multiple times is treated as a string array. A flag specified once is streated as a string.

### Dev

Compiles the extension with a file watcher running to respond to file changes and recompile changes incrementally. It is recommended to set this command to the `start` script of the `package.json` for rapid prototyping. The `process.env.NODE_ENV` variable has a value of `development`.

### Test

Compiles the extension and runs tests using [Playwright](https://playwright.dev). Tests are expected to be in the `tests` directory with a `.test.ts` suffix. There should be at least one full integration test defined.  The `process.env.NODE_ENV` variable has a value of `test`.

The `samepage` package also exposes a set of testing utilities available in the `testing` module. These utilities are meant to ease the development of tests and provide a consistent SamePage test client to test against.

### Build

Compiles the extension with a `process.env.NODE_ENV` value of `production`.

### Publish

Coming soon...
