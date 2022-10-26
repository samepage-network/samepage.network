import base from "fuegojs/utils/base";
import getMysql from "fuegojs/utils/mysql";
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
    const cxn = await getMysql();
    const [testNotebooks] = await cxn.execute(`SELECT t.value, n.uuid 
    FROM notebooks n
    INNER JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
    INNER JOIN tokens t ON t.uuid = l.token_uuid
    WHERE n.app = 0 AND n.workspace = 'test'`);
    const [{ value, uuid }] = testNotebooks as {
      uuid: string;
      value: string;
    }[];
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
        plaintextValue: uuid,
        provider,
      });
      new ActionsSecret(this, `${repo}_deploy_samepage_test_token`, {
        repository: `${repo}-samepage`,
        secretName: "SAMEPAGE_TEST_TOKEN",
        plaintextValue: value,
        provider,
      });
    });
  },
});
