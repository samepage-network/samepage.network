import base from "fuegojs/utils/base";
import {
  ActionsSecret,
  ActionsOrganizationSecret,
} from "@cdktf/provider-github";
import schema from "./schema";

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
    "samepage_test_uuid",
    "samepage_test_token",
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
    new ActionsOrganizationSecret(this, `deploy_samepage_test_uuid`, {
      visibility: "all",
      secretName: "SAMEPAGE_TEST_UUID",
      plaintextValue: process.env.SAMEPAGE_TEST_UUID,
    });
    new ActionsOrganizationSecret(this, `deploy_samepage_test_token`, {
      visibility: "all",
      secretName: "SAMEPAGE_TEST_TOKEN",
      plaintextValue: process.env.SAMEPAGE_TEST_TOKEN,
    });

    // TODO migrate google verification route53 record
  },
});
