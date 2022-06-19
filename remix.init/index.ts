#!/usr/bin/env node
import AWS from "aws-sdk";
import axios from "axios";
import chalk from "chalk";
import spawn, { sync } from "cross-spawn";
import fs from "fs";
import Mustache from "mustache";
import mysql from "mysql";
import path from "path";
import randomstring from "randomstring";
import readline from "readline";

type Task = {
  title: string;
  task: () => void | Promise<unknown>;
  skip?: () => boolean;
};

const main = ({ rootDirectory }: { rootDirectory: string }): Promise<void> => {
  AWS.config.credentials = new AWS.SharedIniFileCredentials({
    profile: "davidvargas",
  });
  const iam = new AWS.IAM({ apiVersion: "2010-05-08" });
  const route53 = new AWS.Route53({ apiVersion: "2013-04-01" });
  const domains = new AWS.Route53Domains({
    apiVersion: "2014-05-15",
  });
  const rds = new AWS.RDS({ apiVersion: "2014-10-31" });
  const githubOpts = {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
    },
  };
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const rlp = (q: string) =>
    new Promise<string>((resolve) => rl.question(q, resolve));
  const projectName = path.basename(rootDirectory);
  const safeProjectName = projectName.replace(/\./g, "-");
  const mysqlName = safeProjectName.replace(/-/g, "_");
  const DomainName = projectName.split(".").slice(-2).join(".");
  const isSubdomain = projectName.split(".").length > 2;

  const getHostedZoneIdByName = async () => {
    let finished = false;
    let props: { Marker?: string } = {};
    while (!finished) {
      const { HostedZones, IsTruncated, NextMarker } = await route53
        .listHostedZones(props)
        .promise();
      const zone = HostedZones.find((i) => i.Name === `${DomainName}.`);
      if (zone) {
        return zone.Id.replace(/\/hostedzone\//, "");
      }
      finished = !IsTruncated;
      props = { Marker: NextMarker };
    }

    return null;
  };

  const checkAvailability = (): Promise<string> =>
    domains
      .checkDomainAvailability({ DomainName })
      .promise()
      .then((r) =>
        r.Availability === "PENDING" ? checkAvailability() : r.Availability
      );

  const checkDomainStatus = (OperationId: string): Promise<void> =>
    domains
      .getOperationDetail({ OperationId })
      .promise()
      .then((d) => {
        if (d.Status === "IN_PROGRESS" || d.Status === "SUBMITTED") {
          console.log(
            chalk.yellow(
              "Checking domain registration again at",
              new Date().toJSON()
            )
          );
          return new Promise((resolve) =>
            setTimeout(() => resolve(checkDomainStatus(OperationId)), 30000)
          );
        } else if (d.Status === "SUCCESSFUL") {
          console.log(
            chalk.green(
              "Domain successfully registered at",
              new Date().toJSON()
            )
          );
          return;
        } else {
          console.log(chalk.red(JSON.stringify(d)));
          throw new Error("Failed to register domain. aborting...");
        }
      });

  const checkGhStatus = (id: string): Promise<void> =>
    axios
      .get(
        `https://api.github.com/repos/dvargas92495/${projectName}/actions/runs/${id}`
      )
      .then((r) => {
        if (r.data.status === "queued" || r.data.status === "in_progress") {
          console.log(
            chalk.yellow("Checking github action again at", new Date().toJSON())
          );
          return new Promise((resolve) =>
            setTimeout(() => resolve(checkGhStatus(id)), 30000)
          );
        } else if (r.data.status === "completed") {
          if (r.data.conclusion === "success") {
            console.log(chalk.green("Site deployed at", new Date().toJSON()));
          } else {
            console.log(
              chalk.yellow(
                `Action completed with conclusion ${r.data.conclusion}. Time to investigate...`
              )
            );
          }
          return;
        } else {
          console.log(chalk.red(r.data.status));
          throw new Error("Failed to deploy site. aborting...");
        }
      });

  const tasks: Task[] = [
    {
      title: "Verify site ownership",
      task: () => {
        return getHostedZoneIdByName().then((id) => {
          if (id) {
            return console.log(
              chalk.yellow(
                "Already own domain in hosted zone",
                id,
                "moving on..."
              )
            );
          }
          return checkAvailability().then((r) => {
            if (r !== "AVAILABLE") {
              return domains
                .getDomainSuggestions({
                  DomainName,
                  OnlyAvailable: true,
                  SuggestionCount: 10,
                })
                .promise()
                .then((s) => {
                  throw new Error(
                    `Domain ${DomainName} is not available and not owned (${r}), try one of these:\n${s.SuggestionsList?.map(
                      (s) => `- ${s.DomainName}`
                    )}\naborting...`
                  );
                });
            }
            console.log(chalk.blue("Buying domain", DomainName));
            const {
              AddressLine1 = "",
              AddressLine2 = "",
              City = "",
              State = "",
              ZipCode = "",
              PhoneNumber = "",
            } = JSON.parse(process.env.CONTACT_DETAIL || "{}");
            if (
              !AddressLine1 ||
              !AddressLine2 ||
              !City ||
              !State ||
              !ZipCode ||
              !PhoneNumber
            ) {
              throw new Error(
                "Invalid Address entered in CONTACT_DETAIL stringified JSON env variable"
              );
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
              ZipCode,
            };
            return domains
              .registerDomain({
                TechContact: Contact,
                RegistrantContact: Contact,
                AdminContact: Contact,
                DomainName,
                DurationInYears: 1,
              })
              .promise()
              .then((r) => {
                console.log(
                  chalk.green(
                    "Successfully bought",
                    DomainName,
                    "operation id:",
                    r.OperationId
                  )
                );
                return checkDomainStatus(r.OperationId);
              });
          });
        });
      },
    },
    {
      title: "Create RDS DB",
      task: () =>
        rds
          .describeDBInstances({ DBInstanceIdentifier: "vargas-arts" })
          .promise()
          .then((r) => {
            if (!r.DBInstances?.length)
              throw new Error("Could not find main RDS instance");
            const { Address, Port } = r.DBInstances[0].Endpoint || {};
            const connection = mysql.createConnection({
              host: Address,
              port: Port,
              user: "dvargas92495",
              password: process.env.RDS_MASTER_PASSWORD,
            });
            connection.connect();
            process.env.MYSQL_PASSWORD = randomstring.generate(16);
            process.env.MYSQL_HOST = Address;
            process.env.MYSQL_PORT = `${Port}`;
            return new Promise((resolve) =>
              connection.query(`CREATE DATABASE ${mysqlName}`, resolve)
            )
              .then(
                () =>
                  new Promise((resolve) =>
                    connection.query(
                      `CREATE USER '${mysqlName}'@'%' IDENTIFIED BY '${process.env.MYSQL_PASSWORD}'`,
                      resolve
                    )
                  )
              )
              .then(
                () =>
                  new Promise((resolve) =>
                    connection.query(
                      `GRANT ALL PRIVILEGES ON ${mysqlName} . * TO '${mysqlName}'@'%'`,
                      resolve
                    )
                  )
              )
              .then(
                () =>
                  new Promise((resolve) =>
                    connection.query(`FLUSH PRIVILEGES`, resolve)
                  )
              )
              .then(() => connection.end());
          }),
    },
    {
      title: "Create local DB",
      task: () => {
        const connection = mysql.createConnection({
          host: "localhost",
          port: 5432,
          user: "root",
          password: process.env.LOCAL_MYSQL_PASSWORD,
        });
        connection.connect();
        return new Promise((resolve) =>
          connection.query(`CREATE DATABASE ${mysqlName}`, resolve)
        )
          .then(
            () =>
              new Promise((resolve) =>
                connection.query(
                  `CREATE USER '${mysqlName}'@'%' IDENTIFIED BY '${mysqlName}'`,
                  resolve
                )
              )
          )
          .then(
            () =>
              new Promise((resolve) =>
                connection.query(
                  `GRANT ALL PRIVILEGES ON ${mysqlName} . * TO '${mysqlName}'@'%'`,
                  resolve
                )
              )
          )
          .then(
            () =>
              new Promise((resolve) =>
                connection.query(`FLUSH PRIVILEGES`, resolve)
              )
          )
          .then(() => connection.end());
      },
    },
    {
      title: "Set up Clerk",
      task: () => {
        return rlp(
          isSubdomain
            ? `Navigate to the clerk project linked to ${DomainName}. Press enter when done.`
            : `Create an application on https://dashboard.clerk.dev/applications called ${projectName}. Press enter when done.`
        )
          .then(() =>
            rlp("Enter the developer api key:").then(
              (k) => (process.env.CLERK_DEV_API_KEY = k)
            )
          )
          .then(() =>
            rlp("Enter the developer clerk frontend API url:").then(
              (k) => (process.env.CLERK_DEV_FRONTEND_API = k)
            )
          )
          .then(() => {
            if (!isSubdomain) {
              console.log(
                chalk.blue(
                  "Check on custom urls in redirect config. Then create production instance on same settings.\nCurrently, there's a Clerk bug where you have to duplicate this work in production."
                )
              );
              return rlp(
                "Enter the clerk production id, found on the DNS page:"
              ).then((k) => {
                process.env.CLERK_DNS_ID = k;
              });
            }
            return Promise.resolve();
          })
          .then(() =>
            rlp("Enter the production api key:").then(
              (k) => (process.env.CLERK_API_KEY = k)
            )
          );
      },
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
          displayName: projectParts.map(
            (s) => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`
          )[0],
          year: new Date().getFullYear(),
          description: `Description for ${projectName}`,
          tfclerk: !isSubdomain
            ? `
module "aws_clerk" {
  source   = "dvargas92495/clerk/aws"
  version  = "1.0.4"

  zone_id  = module.aws_static_site.route53_zone_id
  clerk_id = "${process.env.CLERK_DNS_ID}"
}
`
            : ``,
          clerkDevFrontendApi: process.env.CLERK_DEV_FRONTEND_API,
          stripePublicKey: process.env.TEST_STRIPE_PUBLIC,
        };
        const readDir = (s: string): string[] =>
          fs.existsSync(s)
            ? fs
                .readdirSync(s, { withFileTypes: true })
                .flatMap((f) =>
                  f.isDirectory()
                    ? readDir(`${s}/${f.name}`)
                    : [`${s}/${f.name}`]
                )
            : [];
        const files = readDir(rootDirectory);
        files
          .filter(
            (f) => !f.includes("remix.init") && !f.includes("node_modules")
          )
          .forEach((f) => {
            try {
              fs.writeFileSync(
                f,
                Mustache.render(
                  fs.readFileSync(f).toString(),
                  view,
                  {},
                  {
                    tags: ["{{{", "}}}"],
                    escape: (s) => s,
                  }
                )
              );
            } catch (e) {
              console.error(chalk.red(`Failed to mustache ${f}`));
            }
          });
      },
    },
    {
      title: "Create a github repo",
      task: () => {
        return axios
          .get(`https://api.github.com/repos/dvargas92495/${projectName}`)
          .then(() => console.log(chalk.yellow("Repo already exists.")))
          .catch((e) =>
            e.response?.status === 404
              ? axios
                  .post(
                    "https://api.github.com/user/repos",
                    {
                      name: projectName,
                      homepage: projectName,
                    },
                    githubOpts
                  )
                  .catch((err) =>
                    console.log(
                      chalk.red("Failed to create repo", err.response?.data)
                    )
                  )
              : console.log(chalk.red("Failed to check repo", e.response?.data))
          );
      },
      skip: () => !process.env.GITHUB_TOKEN,
    },
    {
      title: "Git init",
      task: () => {
        try {
          process.chdir(rootDirectory);
          return sync("git init", { stdio: "ignore" });
        } catch (e) {
          console.log(chalk.red("Failed to git init"));
          console.log(e);
          return Promise.resolve();
        }
      },
    },
    {
      title: "Git add",
      task: () => {
        try {
          return sync("git add -A", { stdio: "ignore" });
        } catch (e) {
          console.log(chalk.red("Failed to git add"));
          return Promise.reject(e);
        }
      },
    },
    {
      title: "Git commit",
      task: () => {
        try {
          return sync('git commit -m "Initial commit from Remix Fuego Stack"', {
            stdio: "ignore",
          });
        } catch (e) {
          console.log(chalk.red("Failed to git commit"));
          return Promise.reject(e);
        }
      },
    },
    {
      title: "Git remote",
      task: () => {
        try {
          return new Promise<void>((resolve, reject) => {
            const child = spawn(
              "git",
              [
                "remote",
                "add",
                "origin",
                `https://github.com/dvargas92495/${projectName}.git`,
              ],
              {
                stdio: "inherit",
              }
            );
            child.on("close", (code) => {
              if (code !== 0) {
                reject(code);
                return;
              }
              resolve();
            });
          });
        } catch (e) {
          console.log(chalk.red("Failed to git remote"));
          return Promise.reject(e);
        }
      },
    },
    {
      title: "Git push",
      task: () => {
        try {
          return sync(`git push origin main`, { stdio: "ignore" });
        } catch (e) {
          console.log(chalk.red("Failed to git push"));
          return Promise.reject(e);
        }
      },
    },
    {
      title: "Create Site Manager",
      task: () => {
        return iam
          .createUser({
            UserName: safeProjectName,
          })
          .promise()
          .then(() =>
            Promise.all([
              iam
                .addUserToGroup({
                  UserName: safeProjectName,
                  GroupName: "static-site-managers",
                })
                .promise(),
              ...[
                "arn:aws:iam::aws:policy/AWSLambda_FullAccess",
                "arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator",
                "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
                "arn:aws:iam::aws:policy/AmazonSESFullAccess",
              ].map((PolicyArn) =>
                iam
                  .attachUserPolicy({
                    UserName: safeProjectName,
                    PolicyArn,
                  })
                  .promise()
              ),
            ])
          )
          .then(() =>
            iam.createAccessKey({ UserName: safeProjectName }).promise()
          )
          .then((creds) => {
            process.env.AWS_ACCESS_KEY_ID = creds.AccessKey.AccessKeyId;
            process.env.AWS_SECRET_ACCESS_KEY = creds.AccessKey.SecretAccessKey;
            fs.appendFileSync(
              path.resolve(`${process.env.HOME}/.aws/credentials`),
              `[${safeProjectName}]\naws_access_key_id = ${creds.AccessKey.AccessKeyId}\naws_secret_access_key = ${creds.AccessKey.SecretAccessKey}\n`
            );
            console.log(
              chalk.green("Successfully created keys for", safeProjectName)
            );
            return;
          });
      },
    },
    {
      title: "Create Workspace And Kick off Run",
      task: () => {
        const tfOpts = {
          headers: {
            Authorization: `Bearer ${process.env.TERRAFORM_ORGANIZATION_TOKEN}`,
            "Content-Type": "application/vnd.api+json",
          },
        };
        const userTfOpts = {
          ...tfOpts,
          headers: {
            ...tfOpts.headers,
            Authorization: `Bearer ${process.env.TERRAFORM_USER_TOKEN}`,
          },
        };
        return axios
          .get<{
            data: { attributes: { "service-provider": string }; id: string }[];
          }>(
            "https://app.terraform.io/api/v2/organizations/VargasArts/oauth-clients",
            tfOpts
          )
          .then(
            (r) =>
              r.data.data.find(
                (cl) => cl.attributes["service-provider"] === "github"
              )?.id
          )
          .then((id) =>
            axios
              .get(
                `https://app.terraform.io/api/v2/oauth-clients/${id}/oauth-tokens`,
                tfOpts
              )
              .then((r) => r.data.data[0].id)
          )
          .then((id) =>
            axios
              .post(
                "https://app.terraform.io/api/v2/organizations/VargasArts/workspaces",
                {
                  data: {
                    type: "workspaces",
                    attributes: {
                      name: safeProjectName,
                      "auto-apply": true,
                      "vcs-repo": {
                        "oauth-token-id": id,
                        identifier: `dvargas92495/${projectName}`,
                      },
                    },
                  },
                },
                tfOpts
              )
              .then((r) => r.data.data.id)
          )
          .then((id) =>
            Promise.all(
              [
                { key: "aws_access_token", env: "AWS_ACCESS_KEY_ID" },
                { key: "aws_secret_token", env: "AWS_SECRET_ACCESS_KEY" },
                { key: "secret", value: randomstring.generate(32) },
                { key: "github_token", env: "GITHUB_TOKEN" },
                { key: "mysql_password", env: "MYSQL_PASSWORD" },
                { key: "clerk_api_key", env: "CLERK_API_KEY" },
                { key: "stripe_public", env: "LIVE_STRIPE_PUBLIC" },
                { key: "stripe_secret", env: "LIVE_STRIPE_SECRET" },
                {
                  key: "stripe_webhook_secret",
                  env: "LIVE_STRIPE_WEBHOOK_SECRET",
                },
              ].map(({ key, env, value }) => {
                const inEnv = !!process.env[env || ""];
                if (!inEnv && !value) {
                  console.log(
                    chalk.yellow(
                      "Did not find value or env",
                      env,
                      "for key",
                      key,
                      "be sure to edit it later!"
                    )
                  );
                }
                return axios.post(
                  `https://app.terraform.io/api/v2/workspaces/${id}/vars`,
                  {
                    data: {
                      type: "vars",
                      attributes: {
                        key,
                        sensitive: true,
                        category: "terraform",
                        value: value || (env && process.env[env]) || "",
                      },
                    },
                  },
                  tfOpts
                );
              })
            )
              .then(() =>
                axios.post(
                  `https://app.terraform.io/api/v2/runs`,
                  {
                    data: {
                      attributes: {
                        message: "Kicking off first run",
                      },
                      type: "runs",
                      relationships: {
                        workspace: {
                          data: {
                            type: "workspaces",
                            id,
                          },
                        },
                      },
                    },
                  },
                  userTfOpts
                )
              )
              .then((r) => {
                const runId = r.data.data.id;
                console.log(
                  chalk.green(`Successfully kicked off run ${runId}`)
                );
                const checkTerraformStatus = (): Promise<void> =>
                  axios
                    .get(
                      `https://app.terraform.io/api/v2/runs/${runId}`,
                      userTfOpts
                    )
                    .then((d) => {
                      const { status } = d.data.data.attributes;
                      if (
                        status === "pending" ||
                        status === "planning" ||
                        status === "applying" ||
                        status === "plan_queued"
                      ) {
                        console.log(
                          chalk.yellow(
                            "Checking terraform run again at",
                            new Date().toJSON()
                          )
                        );
                        return new Promise((resolve) =>
                          setTimeout(
                            () => resolve(checkTerraformStatus()),
                            30000
                          )
                        );
                      } else if (status === "applied") {
                        console.log(
                          chalk.green(
                            "Resources successfully created at",
                            new Date().toJSON()
                          )
                        );
                        return;
                      } else {
                        console.log(
                          chalk.red(JSON.stringify(d.data.data.attributes))
                        );
                        throw new Error(
                          "Failed to create resources. aborting..."
                        );
                      }
                    });
                return checkTerraformStatus();
              })
              .catch((e) => {
                console.log(
                  chalk.yellow(
                    `Failed to kick off the terraform run. Do so manually. Error:`
                  )
                );
                console.log(chalk.yellow(e));
              })
          );
      },
    },
    {
      title: "Write .env",
      task: () => {
        return Promise.resolve(
          fs.writeFileSync(
            ".env",
            `API_URL=http://localhost:3003
CLERK_API_KEY=${process.env.CLERK_DEV_API_KEY}
CLERK_FRONTEND_API=${process.env.CLERK_DEV_FRONTEND_API}
DATABASE_URL=mysql://${mysqlName}:${mysqlName}@localhost:5432/${mysqlName}
ORIGIN=http://localhost:3000
STRIPE_PUBLIC_KEY=${process.env.TEST_STRIPE_PUBLIC}
STRIPE_SECRET_KEY=${process.env.TEST_STRIPE_SECRET}
STRIPE_WEBHOOK_SECRET=${process.env.TEST_STRIPE_WEBHOOK_SECRET}
  `
          )
        );
      },
    },
    {
      title: "Kick off first action",
      task: () =>
        axios
          .post(
            `https://api.github.com/repos/dvargas92495/${projectName}/actions/workflows/main.yaml/dispatches`,
            { ref: "main" },
            githubOpts
          )
          .then(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve(
                      axios
                        .get(
                          `https://api.github.com/repos/dvargas92495/${projectName}/actions/runs`
                        )
                        .then((r) => checkGhStatus(r.data.workflow_runs[0].id))
                    ),
                  10000
                )
              )
          ),
    },
    {
      title: "Execute these Manual Steps:",
      task: () => {
        if (!isSubdomain) {
          console.log(
            chalk.blue(
              "- Setup Google Project on https://console.cloud.google.com/projectselector2/home/dashboard?organizationId=0"
            )
          );
          console.log(
            chalk.blue(
              `- Create OauthClient id on https://console.cloud.google.com/apis/credentials?project=${safeProjectName}`
            )
          );
          console.log(
            chalk.blue("- Click Deploy on the Clerk Production Instance")
          );
          return rlp(`Press enter when done.`);
        }
        return Promise.resolve();
      },
    },
  ];

  const run = async () => {
    for (const task of tasks) {
      console.log(chalk.blue("Running", task.title, "..."));
      if (task.skip?.()) {
        console.log(chalk.blueBright("Skipped", task.title));
        continue;
      }
      const result = await Promise.resolve(task.task)
        .then((t) => t())
        .then(() => {
          console.log(chalk.greenBright("Successfully Ran", task.title));
          return { success: true as const, message: "" };
        })
        .catch((e) => {
          console.log(chalk.redBright("Failed to run", task.title));
          return { success: false as const, message: e.message };
        });
      if (!result.success) {
        const rest = tasks.slice(tasks.indexOf(task) + 1);
        rest.forEach((r) =>
          console.log(
            chalk.grey(
              "Skipped task",
              r.title,
              "due to failure from previous task"
            )
          )
        );
        return Promise.reject(result.message);
      }
    }
    return { success: true as const, message: "" };
  };

  return run()
    .then(() => console.log(chalk.greenBright(`${projectName} is Ready!`)))
    .catch((e) => console.error(chalk.redBright(e)))
    .finally(() => rl.close());
};

export default main;
