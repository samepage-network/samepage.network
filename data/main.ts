import base from "fuegojs/utils/base";
import APPS from "../package/internal/apps";
import schema from "./schema";
import { ActionsSecret, GithubProvider } from "@cdktf/provider-github";

base({
  projectName: "samepage.network",
  emailDomain: "samepage.network",
  clerkDnsId: "l7zkq208u6ys",
  schema,
  variables: [
    "convertkit_api_key",
    "password_secret_key",
    "staging_clerk_api_key",
    "web3_storage_api_key",
    "samepage_test_uuid",
    "samepage_test_token",
  ],
  backendProps: {
    sizes: {
      "page/post": "5120",
    },
  },
  async callback() {
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
    // 1. grab the samepage test uuid and token
    // 2. apply it as a gh action to all repos
    APPS.slice(1).forEach(({ repo }) => {
      new ActionsSecret(this, `${repo}_deploy_aws_access_key`, {
        repository: `${repo}-samepage`,
        secretName: "SAMEPAGE_AWS_ACCESS_KEY",
        plaintextValue: (accessKey as ActionsSecret).plaintextValue,
        provider,
      });
      new ActionsSecret(this, `${repo}_deploy_aws_access_secret`, {
        repository: `${repo}-samepage`,
        secretName: "SAMEPAGE_AWS_ACCESS_SECRET",
        plaintextValue: (accessSecret as ActionsSecret).plaintextValue,
        provider,
      });
      new ActionsSecret(this, `${repo}_deploy_samepage_test_uuid`, {
        repository: `${repo}-samepage`,
        secretName: "SAMEPAGE_TEST_UUID",
        plaintextValue: process.env.SAMEPAGE_TEST_UUID,
        provider,
      });
      new ActionsSecret(this, `${repo}_deploy_samepage_test_token`, {
        repository: `${repo}-samepage`,
        secretName: "SAMEPAGE_TEST_TOKEN",
        plaintextValue: process.env.SAMEPAGE_TEST_TOKEN,
        provider,
      });
    });
  },
});

// base({
//   projectName: "samepage.network",
//   emailDomain: "samepage.network",
//   clerkDnsId: "l7zkq208u6ys",
// })
