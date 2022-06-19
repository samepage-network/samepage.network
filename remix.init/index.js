#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};
__export(exports, {
  default: () => remix_default
});
var import_aws_sdk = __toModule(require("aws-sdk"));
var import_axios = __toModule(require("axios"));
var import_chalk = __toModule(require("chalk"));
var import_cross_spawn = __toModule(require("cross-spawn"));
var import_fs = __toModule(require("fs"));
var import_mustache = __toModule(require("mustache"));
var import_mysql = __toModule(require("mysql"));
var import_path = __toModule(require("path"));
var import_randomstring = __toModule(require("randomstring"));
var import_readline = __toModule(require("readline"));
const main = ({ rootDirectory }) => {
  import_aws_sdk.default.config.credentials = new import_aws_sdk.default.SharedIniFileCredentials({
    profile: "davidvargas"
  });
  const iam = new import_aws_sdk.default.IAM({ apiVersion: "2010-05-08" });
  const route53 = new import_aws_sdk.default.Route53({ apiVersion: "2013-04-01" });
  const domains = new import_aws_sdk.default.Route53Domains({
    apiVersion: "2014-05-15"
  });
  const rds = new import_aws_sdk.default.RDS({ apiVersion: "2014-10-31" });
  const githubOpts = {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`
    }
  };
  const rl = import_readline.default.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const rlp = (q) => new Promise((resolve) => rl.question(q, resolve));
  const projectName = import_path.default.basename(rootDirectory);
  const safeProjectName = projectName.replace(/\./g, "-");
  const mysqlName = safeProjectName.replace(/-/g, "_");
  const DomainName = projectName.split(".").slice(-2).join(".");
  const isSubdomain = projectName.split(".").length > 2;
  const getHostedZoneIdByName = async () => {
    let finished = false;
    let props = {};
    while (!finished) {
      const { HostedZones, IsTruncated, NextMarker } = await route53.listHostedZones(props).promise();
      const zone = HostedZones.find((i) => i.Name === `${DomainName}.`);
      if (zone) {
        return zone.Id.replace(/\/hostedzone\//, "");
      }
      finished = !IsTruncated;
      props = { Marker: NextMarker };
    }
    return null;
  };
  const checkAvailability = () => domains.checkDomainAvailability({ DomainName }).promise().then((r) => r.Availability === "PENDING" ? checkAvailability() : r.Availability);
  const checkDomainStatus = (OperationId) => domains.getOperationDetail({ OperationId }).promise().then((d) => {
    if (d.Status === "IN_PROGRESS" || d.Status === "SUBMITTED") {
      console.log(import_chalk.default.yellow("Checking domain registration again at", new Date().toJSON()));
      return new Promise((resolve) => setTimeout(() => resolve(checkDomainStatus(OperationId)), 3e4));
    } else if (d.Status === "SUCCESSFUL") {
      console.log(import_chalk.default.green("Domain successfully registered at", new Date().toJSON()));
      return;
    } else {
      console.log(import_chalk.default.red(JSON.stringify(d)));
      throw new Error("Failed to register domain. aborting...");
    }
  });
  const checkGhStatus = (id) => import_axios.default.get(`https://api.github.com/repos/dvargas92495/${projectName}/actions/runs/${id}`).then((r) => {
    if (r.data.status === "queued" || r.data.status === "in_progress") {
      console.log(import_chalk.default.yellow("Checking github action again at", new Date().toJSON()));
      return new Promise((resolve) => setTimeout(() => resolve(checkGhStatus(id)), 3e4));
    } else if (r.data.status === "completed") {
      if (r.data.conclusion === "success") {
        console.log(import_chalk.default.green("Site deployed at", new Date().toJSON()));
      } else {
        console.log(import_chalk.default.yellow(`Action completed with conclusion ${r.data.conclusion}. Time to investigate...`));
      }
      return;
    } else {
      console.log(import_chalk.default.red(r.data.status));
      throw new Error("Failed to deploy site. aborting...");
    }
  });
  const tasks = [
    {
      title: "Verify site ownership",
      task: () => {
        return getHostedZoneIdByName().then((id) => {
          if (id) {
            return console.log(import_chalk.default.yellow("Already own domain in hosted zone", id, "moving on..."));
          }
          return checkAvailability().then((r) => {
            if (r !== "AVAILABLE") {
              return domains.getDomainSuggestions({
                DomainName,
                OnlyAvailable: true,
                SuggestionCount: 10
              }).promise().then((s) => {
                var _a;
                throw new Error(`Domain ${DomainName} is not available and not owned (${r}), try one of these:
${(_a = s.SuggestionsList) == null ? void 0 : _a.map((s2) => `- ${s2.DomainName}`)}
aborting...`);
              });
            }
            console.log(import_chalk.default.blue("Buying domain", DomainName));
            const {
              AddressLine1 = "",
              AddressLine2 = "",
              City = "",
              State = "",
              ZipCode = "",
              PhoneNumber = ""
            } = JSON.parse(process.env.CONTACT_DETAIL || "{}");
            if (!AddressLine1 || !AddressLine2 || !City || !State || !ZipCode || !PhoneNumber) {
              throw new Error("Invalid Address entered in CONTACT_DETAIL stringified JSON env variable");
            }
            const Contact = {
              ContactType: "PERSON",
              CountryCode: "US",
              Email: "dvargas92495@gmail.com",
              FirstName: "David",
              LastName: "Vargas",
              AddressLine1,
              AddressLine2,
              City,
              PhoneNumber,
              State,
              ZipCode
            };
            return domains.registerDomain({
              TechContact: Contact,
              RegistrantContact: Contact,
              AdminContact: Contact,
              DomainName,
              DurationInYears: 1
            }).promise().then((r2) => {
              console.log(import_chalk.default.green("Successfully bought", DomainName, "operation id:", r2.OperationId));
              return checkDomainStatus(r2.OperationId);
            });
          });
        });
      }
    },
    {
      title: "Create RDS DB",
      task: () => rds.describeDBInstances({ DBInstanceIdentifier: "vargas-arts" }).promise().then((r) => {
        var _a;
        if (!((_a = r.DBInstances) == null ? void 0 : _a.length))
          throw new Error("Could not find main RDS instance");
        const { Address, Port } = r.DBInstances[0].Endpoint || {};
        const connection = import_mysql.default.createConnection({
          host: Address,
          port: Port,
          user: "dvargas92495",
          password: process.env.RDS_MASTER_PASSWORD
        });
        connection.connect();
        process.env.MYSQL_PASSWORD = import_randomstring.default.generate(16);
        process.env.MYSQL_HOST = Address;
        process.env.MYSQL_PORT = `${Port}`;
        return new Promise((resolve) => connection.query(`CREATE DATABASE ${mysqlName}`, resolve)).then(() => new Promise((resolve) => connection.query(`CREATE USER '${mysqlName}'@'%' IDENTIFIED BY '${process.env.MYSQL_PASSWORD}'`, resolve))).then(() => new Promise((resolve) => connection.query(`GRANT ALL PRIVILEGES ON ${mysqlName} . * TO '${mysqlName}'@'%'`, resolve))).then(() => new Promise((resolve) => connection.query(`FLUSH PRIVILEGES`, resolve))).then(() => connection.end());
      })
    },
    {
      title: "Create local DB",
      task: () => {
        const connection = import_mysql.default.createConnection({
          host: "localhost",
          port: 5432,
          user: "root",
          password: process.env.LOCAL_MYSQL_PASSWORD
        });
        connection.connect();
        return new Promise((resolve) => connection.query(`CREATE DATABASE ${mysqlName}`, resolve)).then(() => new Promise((resolve) => connection.query(`CREATE USER '${mysqlName}'@'%' IDENTIFIED BY '${mysqlName}'`, resolve))).then(() => new Promise((resolve) => connection.query(`GRANT ALL PRIVILEGES ON ${mysqlName} . * TO '${mysqlName}'@'%'`, resolve))).then(() => new Promise((resolve) => connection.query(`FLUSH PRIVILEGES`, resolve))).then(() => connection.end());
      }
    },
    {
      title: "Set up Clerk",
      task: () => {
        return rlp(isSubdomain ? `Navigate to the clerk project linked to ${DomainName}. Press enter when done.` : `Create an application on https://dashboard.clerk.dev/applications called ${projectName}. Press enter when done.`).then(() => rlp("Enter the developer api key:").then((k) => process.env.CLERK_DEV_API_KEY = k)).then(() => rlp("Enter the developer clerk frontend API url:").then((k) => process.env.CLERK_DEV_FRONTEND_API = k)).then(() => {
          if (!isSubdomain) {
            console.log(import_chalk.default.blue("Check on custom urls in redirect config. Then create production instance on same settings.\nCurrently, there's a Clerk bug where you have to duplicate this work in production."));
            return rlp("Enter the clerk production id, found on the DNS page:").then((k) => {
              process.env.CLERK_DNS_ID = k;
            });
          }
          return Promise.resolve();
        }).then(() => rlp("Enter the production api key:").then((k) => process.env.CLERK_API_KEY = k));
      }
    },
    {
      title: "Mustache",
      task: () => {
        const projectParts = projectName.split(".");
        const view = {
          safeProjectName,
          projectName,
          DomainName,
          mysqlName,
          displayName: projectParts.map((s) => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`)[0],
          year: new Date().getFullYear(),
          description: `Description for ${projectName}`,
          tfclerk: !isSubdomain ? `
module "aws_clerk" {
  source   = "dvargas92495/clerk/aws"
  version  = "1.0.4"

  zone_id  = module.aws_static_site.route53_zone_id
  clerk_id = "${process.env.CLERK_DNS_ID}"
}
` : ``,
          clerkDevFrontendApi: process.env.CLERK_DEV_FRONTEND_API,
          stripePublicKey: process.env.TEST_STRIPE_PUBLIC
        };
        const readDir = (s) => import_fs.default.existsSync(s) ? import_fs.default.readdirSync(s, { withFileTypes: true }).flatMap((f) => f.isDirectory() ? readDir(`${s}/${f.name}`) : [`${s}/${f.name}`]) : [];
        const files = readDir(rootDirectory);
        files.filter((f) => !f.includes("remix.init") && !f.includes("node_modules")).forEach((f) => {
          try {
            import_fs.default.writeFileSync(f, import_mustache.default.render(import_fs.default.readFileSync(f).toString(), view, {}, {
              tags: ["{{{", "}}}"],
              escape: (s) => s
            }));
          } catch (e) {
            console.error(import_chalk.default.red(`Failed to mustache ${f}`));
          }
        });
      }
    },
    {
      title: "Create a github repo",
      task: () => {
        return import_axios.default.get(`https://api.github.com/repos/dvargas92495/${projectName}`).then(() => console.log(import_chalk.default.yellow("Repo already exists."))).catch((e) => {
          var _a, _b;
          return ((_a = e.response) == null ? void 0 : _a.status) === 404 ? import_axios.default.post("https://api.github.com/user/repos", {
            name: projectName,
            homepage: projectName
          }, githubOpts).catch((err) => {
            var _a2;
            return console.log(import_chalk.default.red("Failed to create repo", (_a2 = err.response) == null ? void 0 : _a2.data));
          }) : console.log(import_chalk.default.red("Failed to check repo", (_b = e.response) == null ? void 0 : _b.data));
        });
      },
      skip: () => !process.env.GITHUB_TOKEN
    },
    {
      title: "Git init",
      task: () => {
        try {
          process.chdir(rootDirectory);
          return (0, import_cross_spawn.sync)("git init", { stdio: "ignore" });
        } catch (e) {
          console.log(import_chalk.default.red("Failed to git init"));
          console.log(e);
          return Promise.resolve();
        }
      }
    },
    {
      title: "Git add",
      task: () => {
        try {
          return (0, import_cross_spawn.sync)("git add -A", { stdio: "ignore" });
        } catch (e) {
          console.log(import_chalk.default.red("Failed to git add"));
          return Promise.reject(e);
        }
      }
    },
    {
      title: "Git commit",
      task: () => {
        try {
          return (0, import_cross_spawn.sync)('git commit -m "Initial commit from Remix Fuego Stack"', {
            stdio: "ignore"
          });
        } catch (e) {
          console.log(import_chalk.default.red("Failed to git commit"));
          return Promise.reject(e);
        }
      }
    },
    {
      title: "Git remote",
      task: () => {
        try {
          return new Promise((resolve, reject) => {
            const child = (0, import_cross_spawn.default)("git", [
              "remote",
              "add",
              "origin",
              `https://github.com/dvargas92495/${projectName}.git`
            ], {
              stdio: "inherit"
            });
            child.on("close", (code) => {
              if (code !== 0) {
                reject(code);
                return;
              }
              resolve();
            });
          });
        } catch (e) {
          console.log(import_chalk.default.red("Failed to git remote"));
          return Promise.reject(e);
        }
      }
    },
    {
      title: "Git push",
      task: () => {
        try {
          return (0, import_cross_spawn.sync)(`git push origin main`, { stdio: "ignore" });
        } catch (e) {
          console.log(import_chalk.default.red("Failed to git push"));
          return Promise.reject(e);
        }
      }
    },
    {
      title: "Create Site Manager",
      task: () => {
        return iam.createUser({
          UserName: safeProjectName
        }).promise().then(() => Promise.all([
          iam.addUserToGroup({
            UserName: safeProjectName,
            GroupName: "static-site-managers"
          }).promise(),
          ...[
            "arn:aws:iam::aws:policy/AWSLambda_FullAccess",
            "arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator",
            "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
            "arn:aws:iam::aws:policy/AmazonSESFullAccess"
          ].map((PolicyArn) => iam.attachUserPolicy({
            UserName: safeProjectName,
            PolicyArn
          }).promise())
        ])).then(() => iam.createAccessKey({ UserName: safeProjectName }).promise()).then((creds) => {
          process.env.AWS_ACCESS_KEY_ID = creds.AccessKey.AccessKeyId;
          process.env.AWS_SECRET_ACCESS_KEY = creds.AccessKey.SecretAccessKey;
          import_fs.default.appendFileSync(import_path.default.resolve(`${process.env.HOME}/.aws/credentials`), `[${safeProjectName}]
aws_access_key_id = ${creds.AccessKey.AccessKeyId}
aws_secret_access_key = ${creds.AccessKey.SecretAccessKey}
`);
          console.log(import_chalk.default.green("Successfully created keys for", safeProjectName));
          return;
        });
      }
    },
    {
      title: "Create Workspace And Kick off Run",
      task: () => {
        const tfOpts = {
          headers: {
            Authorization: `Bearer ${process.env.TERRAFORM_ORGANIZATION_TOKEN}`,
            "Content-Type": "application/vnd.api+json"
          }
        };
        const userTfOpts = {
          ...tfOpts,
          headers: {
            ...tfOpts.headers,
            Authorization: `Bearer ${process.env.TERRAFORM_USER_TOKEN}`
          }
        };
        return import_axios.default.get("https://app.terraform.io/api/v2/organizations/VargasArts/oauth-clients", tfOpts).then((r) => {
          var _a;
          return (_a = r.data.data.find((cl) => cl.attributes["service-provider"] === "github")) == null ? void 0 : _a.id;
        }).then((id) => import_axios.default.get(`https://app.terraform.io/api/v2/oauth-clients/${id}/oauth-tokens`, tfOpts).then((r) => r.data.data[0].id)).then((id) => import_axios.default.post("https://app.terraform.io/api/v2/organizations/VargasArts/workspaces", {
          data: {
            type: "workspaces",
            attributes: {
              name: safeProjectName,
              "auto-apply": true,
              "vcs-repo": {
                "oauth-token-id": id,
                identifier: `dvargas92495/${projectName}`
              }
            }
          }
        }, tfOpts).then((r) => r.data.data.id)).then((id) => Promise.all([
          { key: "aws_access_token", env: "AWS_ACCESS_KEY_ID" },
          { key: "aws_secret_token", env: "AWS_SECRET_ACCESS_KEY" },
          { key: "secret", value: import_randomstring.default.generate(32) },
          { key: "github_token", env: "GITHUB_TOKEN" },
          { key: "mysql_password", env: "MYSQL_PASSWORD" },
          { key: "clerk_api_key", env: "CLERK_API_KEY" },
          { key: "stripe_public", env: "LIVE_STRIPE_PUBLIC" },
          { key: "stripe_secret", env: "LIVE_STRIPE_SECRET" },
          {
            key: "stripe_webhook_secret",
            env: "LIVE_STRIPE_WEBHOOK_SECRET"
          }
        ].map(({ key, env, value }) => {
          const inEnv = !!process.env[env || ""];
          if (!inEnv && !value) {
            console.log(import_chalk.default.yellow("Did not find value or env", env, "for key", key, "be sure to edit it later!"));
          }
          return import_axios.default.post(`https://app.terraform.io/api/v2/workspaces/${id}/vars`, {
            data: {
              type: "vars",
              attributes: {
                key,
                sensitive: true,
                category: "terraform",
                value: value || env && process.env[env] || ""
              }
            }
          }, tfOpts);
        })).then(() => import_axios.default.post(`https://app.terraform.io/api/v2/runs`, {
          data: {
            attributes: {
              message: "Kicking off first run"
            },
            type: "runs",
            relationships: {
              workspace: {
                data: {
                  type: "workspaces",
                  id
                }
              }
            }
          }
        }, userTfOpts)).then((r) => {
          const runId = r.data.data.id;
          console.log(import_chalk.default.green(`Successfully kicked off run ${runId}`));
          const checkTerraformStatus = () => import_axios.default.get(`https://app.terraform.io/api/v2/runs/${runId}`, userTfOpts).then((d) => {
            const { status } = d.data.data.attributes;
            if (status === "pending" || status === "planning" || status === "applying" || status === "plan_queued") {
              console.log(import_chalk.default.yellow("Checking terraform run again at", new Date().toJSON()));
              return new Promise((resolve) => setTimeout(() => resolve(checkTerraformStatus()), 3e4));
            } else if (status === "applied") {
              console.log(import_chalk.default.green("Resources successfully created at", new Date().toJSON()));
              return;
            } else {
              console.log(import_chalk.default.red(JSON.stringify(d.data.data.attributes)));
              throw new Error("Failed to create resources. aborting...");
            }
          });
          return checkTerraformStatus();
        }).catch((e) => {
          console.log(import_chalk.default.yellow(`Failed to kick off the terraform run. Do so manually. Error:`));
          console.log(import_chalk.default.yellow(e));
        }));
      }
    },
    {
      title: "Write .env",
      task: () => {
        return Promise.resolve(import_fs.default.writeFileSync(".env", `API_URL=http://localhost:3003
CLERK_API_KEY=${process.env.CLERK_DEV_API_KEY}
CLERK_FRONTEND_API=${process.env.CLERK_DEV_FRONTEND_API}
DATABASE_URL=mysql://${mysqlName}:${mysqlName}@localhost:5432/${mysqlName}
ORIGIN=http://localhost:3000
STRIPE_PUBLIC_KEY=${process.env.TEST_STRIPE_PUBLIC}
STRIPE_SECRET_KEY=${process.env.TEST_STRIPE_SECRET}
STRIPE_WEBHOOK_SECRET=${process.env.TEST_STRIPE_WEBHOOK_SECRET}
  `));
      }
    },
    {
      title: "Kick off first action",
      task: () => import_axios.default.post(`https://api.github.com/repos/dvargas92495/${projectName}/actions/workflows/main.yaml/dispatches`, { ref: "main" }, githubOpts).then(() => new Promise((resolve) => setTimeout(() => resolve(import_axios.default.get(`https://api.github.com/repos/dvargas92495/${projectName}/actions/runs`).then((r) => checkGhStatus(r.data.workflow_runs[0].id))), 1e4)))
    },
    {
      title: "Execute these Manual Steps:",
      task: () => {
        if (!isSubdomain) {
          console.log(import_chalk.default.blue("- Setup Google Project on https://console.cloud.google.com/projectselector2/home/dashboard?organizationId=0"));
          console.log(import_chalk.default.blue(`- Create OauthClient id on https://console.cloud.google.com/apis/credentials?project=${safeProjectName}`));
          console.log(import_chalk.default.blue("- Click Deploy on the Clerk Production Instance"));
          return rlp(`Press enter when done.`);
        }
        return Promise.resolve();
      }
    }
  ];
  const run = async () => {
    var _a;
    for (const task of tasks) {
      console.log(import_chalk.default.blue("Running", task.title, "..."));
      if ((_a = task.skip) == null ? void 0 : _a.call(task)) {
        console.log(import_chalk.default.blueBright("Skipped", task.title));
        continue;
      }
      const result = await Promise.resolve(task.task).then((t) => t()).then(() => {
        console.log(import_chalk.default.greenBright("Successfully Ran", task.title));
        return { success: true, message: "" };
      }).catch((e) => {
        console.log(import_chalk.default.redBright("Failed to run", task.title));
        return { success: false, message: e.message };
      });
      if (!result.success) {
        const rest = tasks.slice(tasks.indexOf(task) + 1);
        rest.forEach((r) => console.log(import_chalk.default.grey("Skipped task", r.title, "due to failure from previous task")));
        return Promise.reject(result.message);
      }
    }
    return { success: true, message: "" };
  };
  return run().then(() => console.log(import_chalk.default.greenBright(`${projectName} is Ready!`))).catch((e) => console.error(import_chalk.default.redBright(e))).finally(() => rl.close());
};
var remix_default = main;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
