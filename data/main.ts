import base from "fuegojs/utils/base";
import {
  ActionsSecret,
  ActionsOrganizationSecret,
} from "@cdktf/provider-github";
import schema from "./schema";
import getMysql from "fuegojs/utils/mysql";

base({
  schema,
  projectName: "samepage.network",
  emailSettings: "OUTBOUND",
  clerkDnsId: "l7zkq208u6ys",
  organization: "SamePage",
  variables: [
    "convertkit_api_key",
    "staging_clerk_api_key",
    "web3_storage_api_key",
  ],
  backendProps: {
    sizes: {
      "page/post": "5120",
      "upload-to-ipfs": "5120",
    },
  },
  async callback() {
    const accessKey = this.node.children.find(
      (c) => c.node.id === "deploy_aws_access_key"
    );
    const accessSecret = this.node.children.find(
      (c) => c.node.id === "deploy_aws_access_secret"
    );
    new ActionsOrganizationSecret(this, `deploy_aws_access_key_secret`, {
      visibility: "all",
      secretName: "SAMEPAGE_AWS_ACCESS_KEY",
      plaintextValue: (accessKey as ActionsSecret).plaintextValue,
    });
    new ActionsOrganizationSecret(this, `deploy_aws_access_secret_secret`, {
      visibility: "all",
      secretName: "SAMEPAGE_AWS_ACCESS_SECRET",
      plaintextValue: (accessSecret as ActionsSecret).plaintextValue,
    });

    const cxn = await getMysql();
    const [record] = await cxn.execute(`SELECT t.value, n.uuid FROM tokens t
    INNER JOIN token_notebook_links l ON l.token_uuid = t.uuid
    INNER JOIN notebooks n ON n.uuid = l.notebook_uuid
    WHERE n.app = 0 AND n.workspace = 'test'`);
    cxn.destroy();
    const [creds] = record as { uuid: string; value: string }[];
    console.log(typeof creds, creds.uuid);
    if (creds) {
      new ActionsOrganizationSecret(this, `deploy_samepage_test_uuid`, {
        visibility: "all",
        secretName: "SAMEPAGE_TEST_UUID",
        plaintextValue: creds.uuid,
      });
      new ActionsOrganizationSecret(this, `deploy_samepage_test_token`, {
        visibility: "all",
        secretName: "SAMEPAGE_TEST_TOKEN",
        plaintextValue: creds.value,
      });
    }

    // TODO migrate google verification route53 record
  },
});
