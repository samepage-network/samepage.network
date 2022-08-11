import base from "fuegojs/dist/base";
import schema from "./schema";
import { ActionsSecret } from "@cdktf/provider-github";

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
      (c) => c.node.id === "deploy_aws_access_key"
    );
    new ActionsSecret(this, "logseq_deploy_aws_access_key", {
      repository: "logseq-samepage",
      secretName: "DEPLOY_AWS_ACCESS_KEY",
      plaintextValue: (accessKey as ActionsSecret).plaintextValue,
    });
    new ActionsSecret(this, "logseq_deploy_aws_access_key", {
      repository: "logseq-samepage",
      secretName: "DEPLOY_AWS_ACCESS_SECRET",
      plaintextValue: (accessSecret as ActionsSecret).plaintextValue,
    });
  },
});
