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

## Implementing the protocol
