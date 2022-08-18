import base from "fuegojs/dist/base";
import { APPS } from "@samepage/shared";
import schema from "./schema";
import { ActionsSecret, GithubProvider } from "@cdktf/provider-github";

base({
  projectName: "samepage.network",
  emailDomain: "samepage.network",
  clerkDnsId: "l7zkq208u6ys",
  schema,
  variables: ["convertkit_api_key", "password_secret_key"],
  callback() {
    const accessKey = this.node.children.find(
      (c) => c.node.id === "deploy_aws_access_key"
    );
    const accessSecret = this.node.children.find(
      (c) => c.node.id === "deploy_aws_access_secret"
    );

    const provider = new GithubProvider(this, "GITHUB_PERSONAL", {
      token: process.env.GITHUB_TOKEN,
      owner: "dvargas92495",
      alias: "personal",
    });
    APPS.forEach((args) => {
      const key = "key" in args ? args.key : args.name.toLowerCase();
      new ActionsSecret(this, `${key}_deploy_aws_access_key`, {
        repository: `${key}-samepage`,
        secretName: "SAMEPAGE_AWS_ACCESS_KEY",
        plaintextValue: (accessKey as ActionsSecret).plaintextValue,
        provider,
      });
      new ActionsSecret(this, `${key}_deploy_aws_access_secret`, {
        repository: `${key}-samepage`,
        secretName: "SAMEPAGE_AWS_ACCESS_SECRET",
        plaintextValue: (accessSecret as ActionsSecret).plaintextValue,
        provider,
      });
    });
  },
});
