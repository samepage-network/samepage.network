---
title: How To Contribute
description: In-depth guide of how the SamePage repositories are structured and how to contribute
---

All repositories managed by SamePage are open source under the MIT license. This allows developers to create self hosted versions of the network, fork the TFT extensions to versions more suitable for their use case, and contribute freely to the ecosystem.

The SamePage ecosystem is composed of a single monorepo for SamePage core services (the API, client sdks, the website, etc.) as well as a separate repository for each extension for a tool for thought we officially support. All repositories could be found in our organization on [GitHub](https://github.com/samepage-network). We break down each repository below.

## `samepage.network`

This is our main [monorepo](https://github.com/samepage-network/samepage.network).

### Architecture

The repository contains several top level directories that roughly correspond to a separate _deployment target_. Each deployment target has a github action in the `.github/workflows` directory that watches for changes in the corresponding directory on the `main` branch and runs its deployment when it does.

The top level directories are as follows:

- `api` - Each file in this directory represents an [AWS Lambda](https://aws.amazon.com/lambda/) function deployed to our [API gateway](https://aws.amazon.com/api-gateway/). The files within the `ws` subdirectory are deployed to our WebSocket Gateway.
- `app` - The files contained in this directory make up the [Remix](https://remix.run) web application.
- `data` - Defines our SQL and infrastructure schema in a declarative format, using [Zod](https://zod.dev) and the [CDK for Terraform](https://www.terraform.io/cdktf).
- `package` - Defines all of the packages that we publish to `npm`, to be used by extensions for each supported tool for thought. The entire directory is published as a single `samepage` package, as well as individual `@samepage` scoped packages.
- `scripts` - One off scripts that are run within CI and locally to help serve the developer experience for SamePage.
- `template` - Directory we use to generate each additional extension repo.
- `tests` - The suite of tests to protect against regression on our network or packages. Patterns and conventions around testing are still under active development.

The following directories also exist but are expected to be temporary:

- `docs` & `public` - Hosts the static content used by `app`. Expected to migrate into that directory.
- `patches` - Changes made to dependent node modules that we should push upstream to improve the libraries we use.

### Setup

1. Fork the repository to your GitHub account.
1. Clone the repository locally.
1. Install dependencies with `npm install`.
1. Copy the `.env.default` file to `.env`, and replace the values that are marked `TODO`
   1. `CLERK_SECRET_KEY` - Get from `@dvargas92495`
   2. `STRIPE_SECRET_KEY` - Get from `@dvargas92495`
1. Ensure you have a local instance of `mysql` running, with a user with username and password both with the value `samepage_network`, running on port 3306, and a database created called `samepage_network`.
   1. Create Database: `CREATE DATABASE samepage_network;`
   2. Create User: `CREATE USER 'samepage_network'@'localhost' IDENTIFIED BY 'samepage_network';`
   3. Grant Privileges: `GRANT ALL PRIVILEGES ON samepage_network.* TO 'samepage_network'@'localhost';`
1. Apply the SamePage schema to your local `mysql` instance by running `npx ts-node scripts/cli.ts plan --sql`, followed by `npx ts-node scripts/cli.ts apply --sql --bare`.
1. `npm start` to run the app.

### Contributing

1. Create a new branch locally
1. Ensure to either add tests or steps to existing tests that protects against regression of your changes
1. When ready, create a pull request that targets the `main` branch of the original repository
1. When ready, tag `@dvargas92495` for review

## `[tool]`

For each tool for thought that we support, we have a separate repository hosting the code for its extension. We currently support the following clients:

- [Roam](https://github.com/dvargas92495/roamjs-samepage)
- [LogSeq](https://github.com/dvargas92495/logseq-samepage)
- [Obsidian](https://github.com/dvargas92495/obsidian-samepage)

### Setup

1. Fork the repository to your GitHub account.
1. Clone the repository locally.
1. Install dependencies with `npm install`.
1. `npm start` to build the extension in dev mode, running a watcher responding to file changes.

### Contributing

1. Create a new branch locally
1. Ensure to either add tests or steps to existing tests that protects against regression of your changes
1. When ready, create a pull request that targets the `main` branch of the original repository
1. When ready, tag `@dvargas92495` for review
