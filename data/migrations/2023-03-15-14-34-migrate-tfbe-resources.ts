import { execSync } from "child_process";

export const migrate = async () => {
  process.chdir("node_modules/cdktf.out/stacks/samepage-network");
  execSync("terraform init", { stdio: "inherit" });
  const output = execSync(
    "terraform state list | grep module.aws-serverless-backend"
  ).toString();
  const resources = output.split("\n");
  if (resources.length) {
    console.log("migrating", resources.length, "resources");
    resources.forEach((resource) => {
      if (!resource) return;
      const destination = resource
        .replace(/^module\.aws-serverless-backend\./, "")
        .replace(/\["/, "_")
        .replace(/\//, "_")
        .replace(/"\]$/, "")
        .replace(/\[0\]$/, "")
        .replace(
          "aws_iam_policy_document.lambda_execution_policy",
          "aws_iam_policy_document.lambda_execution_policy_document"
        )
        .replace(
          "aws_api_gateway_integration.mock",
          "aws_api_gateway_integration.mock_integration"
        )
        .replace(
          "aws_api_gateway_method_response.mock",
          "aws_api_gateway_method_response.mock_method_response"
        )
        .replace(
          "aws_api_gateway_integration_response.mock",
          "aws_api_gateway_integration_response.mock_integration_response"
        )
        .replace(
          "aws_iam_access_key.update_lambda",
          "aws_iam_access_key.update_lambda_key"
        )
        .replace(
          "aws_iam_user.update_lambda",
          "aws_iam_user.update_lambda_user"
        )
        .replace(
          "aws_iam_user_policy.update_lambda",
          "aws_iam_user_policy.update_lambda_user_policy"
        )
        .replace(
          "aws_acm_certificate.api",
          "aws_acm_certificate.api_certificate"
        )
        .replace(
          "aws_acm_certificate_validation.api",
          "aws_acm_certificate_validation.api_certificate_validation"
        )
        .replace(
          "aws_api_gateway_domain_name.api",
          "aws_api_gateway_domain_name.api_domain_name"
        )
        .replace("aws_route53_record.api", "aws_route53_record.api_record")
        .replace(
          "aws_api_gateway_base_path_mapping.api",
          "aws_api_gateway_base_path_mapping.api_mapping"
        );
      console.log("moving", resource, "to", destination);
      execSync(`terraform state mv '${resource}' ${destination}`).toString();
    });
  } else {
    console.log("no resources to migrate");
  }
};

export const revert = () => {
  return Promise.resolve();
};
