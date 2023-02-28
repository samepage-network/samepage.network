import base from "fuegojs/utils/base";
import { ActionsSecret } from "@cdktf/provider-github/lib/actions-secret";
import { ActionsOrganizationSecret } from "@cdktf/provider-github/lib/actions-organization-secret";
import { TerraformVariable } from "cdktf";
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
    "roadmap_roam_token",
    "stripe_webhook_secret",
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
    const samePageTestPassword = new TerraformVariable(this, "samepage_test_password_secret", {
      type: "string",
    });
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
    new ActionsOrganizationSecret(this, `samepage_test_password_secret`, {
      visibility: "all",
      secretName: "SAMEPAGE_TEST_PASSWORD",
      plaintextValue: samePageTestPassword.value,
    });

    // TODO migrate google verification route53 record
    // - standard TXT record
    // - google._domainkey TXT record
    // - _dmarc TXT record
  },
});
