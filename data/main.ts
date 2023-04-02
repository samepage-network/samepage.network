import { Construct } from "constructs";
import {
  App,
  Fn,
  RemoteBackend,
  TerraformStack,
  TerraformVariable,
} from "cdktf";
import { DataArchiveFile } from "@cdktf/provider-archive/lib/data-archive-file";
import { ArchiveProvider } from "@cdktf/provider-archive/lib/provider";
import { ActionsOrganizationSecret } from "@cdktf/provider-github/lib/actions-organization-secret";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { ApiGatewayRestApi } from "@cdktf/provider-aws/lib/api-gateway-rest-api";
import { ApiGatewayResource } from "@cdktf/provider-aws/lib/api-gateway-resource";
import { ApiGatewayMethod } from "@cdktf/provider-aws/lib/api-gateway-method";
import { ApiGatewayMethodResponse } from "@cdktf/provider-aws/lib/api-gateway-method-response";
import { ApiGatewayIntegrationResponse } from "@cdktf/provider-aws/lib/api-gateway-integration-response";
import { ApiGatewayIntegration } from "@cdktf/provider-aws/lib/api-gateway-integration";
import { ApiGatewayDeployment } from "@cdktf/provider-aws/lib/api-gateway-deployment";
// import { ApiGatewayStage } from "@cdktf/provider-aws/lib/api-gateway-stage";
import { ApiGatewayDomainName } from "@cdktf/provider-aws/lib/api-gateway-domain-name";
import { ApiGatewayBasePathMapping } from "@cdktf/provider-aws/lib/api-gateway-base-path-mapping";
import { AcmCertificate } from "@cdktf/provider-aws/lib/acm-certificate";
import { AcmCertificateValidation } from "@cdktf/provider-aws/lib/acm-certificate-validation";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambda-permission";
import { Route53Record } from "@cdktf/provider-aws/lib/route53-record";
import { CloudfrontCachePolicy } from "@cdktf/provider-aws/lib/cloudfront-cache-policy";
import { IamPolicy } from "@cdktf/provider-aws/lib/iam-policy";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { IamUser } from "@cdktf/provider-aws/lib/iam-user";
import { IamUserPolicy } from "@cdktf/provider-aws/lib/iam-user-policy";
import { IamAccessKey } from "@cdktf/provider-aws/lib/iam-access-key";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { DataAwsIamPolicyDocument } from "@cdktf/provider-aws/lib/data-aws-iam-policy-document";
import { DataAwsCallerIdentity } from "@cdktf/provider-aws/lib/data-aws-caller-identity";
import { GithubProvider } from "@cdktf/provider-github/lib/provider";
import { ActionsSecret } from "@cdktf/provider-github/lib/actions-secret";
import { AwsClerk } from "@dvargas92495/aws-clerk";
import { AwsEmail } from "@dvargas92495/aws-email";
import { AwsWebsocket } from "@dvargas92495/aws-websocket";
import { AwsStaticSite } from "@dvargas92495/aws-static-site";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import readDir from "../package/scripts/internal/readDir";
import compareSqlSchemas from "./compareSqlSchemas";
dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const projectName = "samepage.network";
const safeProjectName = "samepage-network";
const clerkDnsId = "l7zkq208u6ys";

const setupInfrastructure = async (): Promise<void> => {
  class MyStack extends TerraformStack {
    constructor(
      scope: Construct,
      name: string,
      opts: { backendFunctionsByRepo: Record<string, string[]> }
    ) {
      super(scope, name);

      const allVariables = [
        "database_url",
        "clerk_api_key",
        "convertkit_api_key",
        "staging_clerk_api_key",
        "web3_storage_api_key",
        "roadmap_roam_token",
        "stripe_webhook_secret",
        "svix_secret",
        "algolia_app_id",
        "algolia_admin_key",
        "ngrok_auth_token",
      ];
      const aws_access_token = new TerraformVariable(this, "aws_access_token", {
        type: "string",
      });

      const aws_secret_token = new TerraformVariable(this, "aws_secret_token", {
        type: "string",
      });

      const secret = new TerraformVariable(this, "secret", {
        type: "string",
      });

      const aws = new AwsProvider(this, "AWS", {
        region: "us-east-1",
        accessKey: aws_access_token.value,
        secretKey: aws_secret_token.value,
      });

      new GithubProvider(this, "GITHUB", {
        token: process.env.GITHUB_TOKEN,
        owner: process.env.GITHUB_REPOSITORY_OWNER,
      });
      new ArchiveProvider(this, "archive", {});

      const cachePolicy = new CloudfrontCachePolicy(this, "cache_policy", {
        name: `${safeProjectName}-cache-policy`,
        comment: `Caching for ${projectName}`,
        defaultTtl: 1,
        maxTtl: 31536000,
        minTtl: 1,
        parametersInCacheKeyAndForwardedToOrigin: {
          cookiesConfig: { cookieBehavior: "none" },
          headersConfig: { headerBehavior: "none" },
          queryStringsConfig: { queryStringBehavior: "all" },
        },
      });

      const staticSite = new AwsStaticSite(this, "aws_static_site", {
        providers: [
          {
            moduleAlias: "us-east-1",
            provider: aws,
          },
        ],
        originMemorySize: 5120,
        originTimeout: 20,
        domain: projectName,
        secret: secret.value,
        cachePolicyId: cachePolicy.id,
      });

      const extensionPaths = Object.entries(
        opts.backendFunctionsByRepo
      ).flatMap(([repo, paths]) => {
        const lambdas = paths.map((p) => p.replace(/\.ts$/, ""));
        const app = repo.replace(/-samepage$/, "");
        return lambdas
          .filter((p) => p.includes("/"))
          .map((p) => `extensions/${app}/${p}`)
          .concat(
            lambdas
              .filter((p) => !p.includes("/"))
              .map((p) => `extensions-${app}-${p}`)
          );
      });
      const ignorePaths = ["ws", "car", "clerk", "extensions", "mocks"];
      const apiPaths = readDir("api").map((f) =>
        f.replace(/\.ts$/, "").replace(/^api\//, "")
      );
      const allLambdas = apiPaths
        .filter((f) => !ignorePaths.some((i) => f.startsWith(i)))
        .concat(extensionPaths);

      const pathParts = Object.fromEntries(
        allLambdas.map((p) => [p, p.split("/")])
      );
      const resourceLambdas = allLambdas.filter(
        (p) => pathParts[p]?.length > 1
      );
      const resources = Object.fromEntries(
        resourceLambdas.map((p) => [p, pathParts[p].slice(0, -1).join("/")])
      );
      const methods = Object.fromEntries(
        resourceLambdas.map((p) => [p, pathParts[p].slice(-1)[0]])
      );
      const sizes: Record<string, number> = {
        "page/post": 5120,
        "upload-to-ipfs": 5120,
      };

      const callerIdentity = new DataAwsCallerIdentity(this, "tf_caller", {});
      // lambda resource requires either filename or s3... wow
      const dummyFile = new DataArchiveFile(this, "dummy", {
        type: "zip",
        outputPath: "./dummy.zip",
        source: [
          {
            content: "// TODO IMPLEMENT",
            filename: "dummy.js",
          },
        ],
      });

      const assumeLambdaPolicy = new DataAwsIamPolicyDocument(
        this,
        "assume_lambda_policy",
        {
          statement: [
            {
              actions: ["sts:AssumeRole"],
              principals: [
                { identifiers: ["lambda.amazonaws.com"], type: "Service" },
              ],
            },
          ],
        }
      );

      const lamdaExecutionPolicyDocument = new DataAwsIamPolicyDocument(
        this,
        "lambda_execution_policy_document",
        {
          statement: [
            {
              actions: [
                "cloudfront:CreateInvalidation",
                "cloudfront:GetInvalidation",
                "cloudfront:ListDistributions",
                "dynamodb:BatchGetItem",
                "dynamodb:GetItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchWriteItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "execute-api:Invoke",
                "execute-api:ManageConnections",
                "lambda:InvokeFunction",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:CreateLogGroup",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:PutObject",
                "s3:DeleteObject",
                "ses:sendEmail",
              ],
              resources: ["*"],
            },
            {
              actions: ["sts:AssumeRole"],
              resources: [
                `arn:aws:iam::${callerIdentity.accountId}:role/${safeProjectName}-lambda-execution`,
              ],
            },
          ],
        }
      );
      const lamdaExecutionPolicy = new IamPolicy(
        this,
        "lambda_execution_policy",
        {
          name: `${safeProjectName}-lambda-execution`,
          policy: lamdaExecutionPolicyDocument.json,
        }
      );
      const lambdaRole = new IamRole(this, "lambda_role", {
        name: `${safeProjectName}-lambda-execution`,
        assumeRolePolicy: assumeLambdaPolicy.json,
      });
      new IamRolePolicyAttachment(this, "test-attach", {
        role: lambdaRole.name,
        policyArn: lamdaExecutionPolicy.arn,
      });
      const restApi = new ApiGatewayRestApi(this, "rest_api", {
        name: safeProjectName,
        endpointConfiguration: {
          types: ["REGIONAL"],
        },
        binaryMediaTypes: ["multipart/form-data", "application/octet-stream"],
      });

      const apiResources: Record<string, ApiGatewayResource> = {};
      resourceLambdas.forEach((resourcePath) => {
        const parts = pathParts[resourcePath].slice(0, -1);
        parts.forEach((pathPart, i) => {
          const resourceKey = parts.slice(0, i + 1).join("/");
          apiResources[resourceKey] =
            apiResources[resourceKey] ||
            new ApiGatewayResource(
              this,
              `resources_${resourceKey.replace(/\//g, "_")}`,
              {
                restApiId: restApi.id,
                parentId:
                  i === 0
                    ? restApi.rootResourceId
                    : apiResources[parts.slice(0, i).join("/")]?.id,
                pathPart,
              }
            );
        });
      });
      const functionNames = Object.fromEntries(
        allLambdas.map((p) => [
          p,
          pathParts[p].length === 1
            ? pathParts[p][0]
            : `${resources[p].replace(/\//g, "-")}_${methods[p]}`,
        ])
      );
      const lambdaFunctions = Object.fromEntries(
        allLambdas.map((lambdaPath) => [
          lambdaPath,
          new LambdaFunction(
            this,
            `lambda_function_${lambdaPath.replace(/\//g, "_")}`,
            {
              functionName: `${safeProjectName}_${functionNames[lambdaPath]}`,
              role: lambdaRole.arn,
              handler: `${functionNames[lambdaPath]}.handler`,
              filename: dummyFile.outputPath,
              runtime: "nodejs18.x",
              publish: false,
              timeout: 10,
              memorySize: sizes[lambdaPath] || 128,
            }
          ),
        ])
      );
      const gatewayMethods = Object.fromEntries(
        resourceLambdas.map((p) => [
          p,
          new ApiGatewayMethod(
            this,
            `gateway_method_${p.replace(/\//g, "_")}`,
            {
              restApiId: restApi.id,
              resourceId: apiResources[resources[p]].id,
              httpMethod: methods[p].toUpperCase(),
              authorization: "NONE",
            }
          ),
        ])
      );
      const gatewayIntegrations = resourceLambdas.map(
        (p) =>
          new ApiGatewayIntegration(
            this,
            `integration_${p.replace(/\//g, "_")}`,
            {
              restApiId: restApi.id,
              resourceId: apiResources[resources[p]].id,
              httpMethod: methods[p].toUpperCase(),
              type: "AWS_PROXY",
              integrationHttpMethod: "POST",
              uri: lambdaFunctions[p].invokeArn,
              dependsOn: [apiResources[resources[p]], gatewayMethods[p]],
            }
          )
      );
      resourceLambdas.map(
        (p) =>
          new LambdaPermission(this, `apigw_lambda_${p.replace(/\//g, "_")}`, {
            statementId: "AllowExecutionFromAPIGateway",
            action: "lambda:InvokeFunction",
            functionName: lambdaFunctions[p].functionName,
            principal: "apigateway.amazonaws.com",
            // TODO: constrain this to the specific API Gateway Resource
            sourceArn: `${restApi.executionArn}/*/*/*`,
          })
      );
      const mockMethods = Object.fromEntries(
        Object.values(resources).map((resource) => [
          resource,
          new ApiGatewayMethod(
            this,
            `option_method_${resource.replace(/\//g, "_")}`,
            {
              restApiId: restApi.id,
              resourceId: apiResources[resource].id,
              httpMethod: "OPTIONS",
              authorization: "NONE",
            }
          ),
        ])
      );
      const mockIntegrations = Object.fromEntries(
        Object.values(resources).map((resource) => [
          resource,
          new ApiGatewayIntegration(
            this,
            `mock_integration_${resource.replace(/\//g, "_")}`,
            {
              restApiId: restApi.id,
              resourceId: apiResources[resource].id,
              httpMethod: "OPTIONS",
              type: "MOCK",
              passthroughBehavior: "WHEN_NO_MATCH",
              requestTemplates: {
                "application/json": JSON.stringify({ statusCode: 200 }),
              },
            }
          ),
        ])
      );
      const mockMethodResponses = Object.fromEntries(
        Object.values(resources).map((resource) => [
          resource,
          new ApiGatewayMethodResponse(
            this,
            `mock_method_response_${resource.replace(/\//g, "_")}`,
            {
              restApiId: restApi.id,
              resourceId: apiResources[resource].id,
              httpMethod: "OPTIONS",
              statusCode: "200",
              responseModels: {
                "application/json": "Empty",
              },
              responseParameters: {
                "method.response.header.Access-Control-Allow-Headers": true,
                "method.response.header.Access-Control-Allow-Methods": true,
                "method.response.header.Access-Control-Allow-Origin": true,
                "method.response.header.Access-Control-Allow-Credentials": true,
              },
              dependsOn: [apiResources[resource], mockMethods[resource]],
            }
          ),
        ])
      );
      const mockIntegrationResponses = Object.values(resources).map(
        (resource) =>
          new ApiGatewayIntegrationResponse(
            this,
            `mock_integration_response_${resource.replace(/\//g, "_")}`,
            {
              restApiId: restApi.id,
              resourceId: apiResources[resource].id,
              httpMethod: "OPTIONS",
              statusCode: "200",
              responseParameters: {
                "method.response.header.Access-Control-Allow-Headers":
                  "'Authorization,Content-Type'",
                "method.response.header.Access-Control-Allow-Methods":
                  "'GET,OPTIONS,POST,PUT,DELETE'",
                "method.response.header.Access-Control-Allow-Origin": "'*'",
                "method.response.header.Access-Control-Allow-Credentials":
                  "'true'",
              },
              dependsOn: [
                apiResources[resource],
                mockIntegrations[resource],
                mockMethodResponses[resource],
              ],
            }
          )
      );
      // const deployment =
      new ApiGatewayDeployment(this, "production", {
        restApiId: restApi.id,
        stageName: "production",
        triggers: {
          redeployment: Fn.sha1(
            Fn.jsonencode(
              (gatewayIntegrations as { id: string }[])
                .concat(Object.values(apiResources))
                .concat(Object.values(gatewayMethods))
                .concat(Object.values(mockMethods))
                .concat(Object.values(mockIntegrations))
                .concat(Object.values(mockMethodResponses))
                .concat(mockIntegrationResponses)
                .map((t) => t.id)
            )
          ),
        },
        dependsOn: [...Object.values(gatewayMethods), ...gatewayIntegrations],
        lifecycle: {
          createBeforeDestroy: true,
        },
      });
      // Needs to tf import the current stage into it
      // new ApiGatewayStage(this, "production_stage", {
      //   deploymentId: deployment.id,
      //   restApiId: restApi.id,
      //   stageName: "production",
      // });
      const lambdaDeployPolicyDocument = new DataAwsIamPolicyDocument(
        this,
        "deploy_policy",
        {
          statement: [
            {
              actions: ["lambda:UpdateFunctionCode", "lambda:GetFunction"],
              resources: [
                `arn:aws:lambda:us-east-1:${callerIdentity.accountId}:function:samepage-network_*`,
              ],
            },
          ],
        }
      );
      const updateLambdaUser = new IamUser(this, "update_lambda_user", {
        name: `${safeProjectName}-lambda`,
        path: "/",
      });
      const updateLambdaKey = new IamAccessKey(this, "update_lambda_key", {
        user: updateLambdaUser.name,
      });
      new IamUserPolicy(this, "update_lambda_user_policy", {
        user: updateLambdaUser.name,
        policy: lambdaDeployPolicyDocument.json,
      });
      const apiCertificate = new AcmCertificate(this, "api_certificate", {
        domainName: "api.samepage.network",
        validationMethod: "DNS",
        lifecycle: {
          createBeforeDestroy: true,
        },
      });
      const apiCertRecord = new Route53Record(this, "api_cert", {
        name: apiCertificate.domainValidationOptions.get(0).resourceRecordName,
        type: apiCertificate.domainValidationOptions.get(0).resourceRecordType,
        zoneId: staticSite.route53ZoneIdOutput,
        records: [
          apiCertificate.domainValidationOptions.get(0).resourceRecordValue,
        ],
        ttl: 60,
      });
      const apiCertValidation = new AcmCertificateValidation(
        this,
        "api_certificate_validation",
        {
          certificateArn: apiCertificate.arn,
          validationRecordFqdns: [apiCertRecord.fqdn],
        }
      );
      const apiDomain = new ApiGatewayDomainName(this, "api_domain_name", {
        domainName: "api.samepage.network",
        certificateArn: apiCertValidation.certificateArn,
      });
      new Route53Record(this, "api_record", {
        name: apiDomain.domainName,
        type: "A",
        zoneId: staticSite.route53ZoneIdOutput,
        alias: [
          {
            evaluateTargetHealth: true,
            name: apiDomain.cloudfrontDomainName,
            zoneId: apiDomain.cloudfrontZoneId,
          },
        ],
      });
      new ApiGatewayBasePathMapping(scope, "api_mapping", {
        apiId: restApi.id,
        stageName: "production",
        domainName: apiDomain.domainName,
      });

      const additionalPolicy = new DataAwsIamPolicyDocument(
        this,
        "additional_deploy_policy",
        {
          statement: [
            {
              actions: [
                "lambda:UpdateFunctionCode",
                "lambda:GetFunction",
                "lambda:EnableReplication*",
              ],
              resources: [
                `arn:aws:lambda:us-east-1:${callerIdentity.accountId}:function:samepage-network_extensions-*`,
              ],
            },
          ],
        }
      );
      new IamUserPolicy(this, "deploy_additional", {
        name: "deploy_additional",
        user: "samepage.network-deploy",
        policy: additionalPolicy.json,
      });

      const wsPaths = apiPaths
        .filter((p) => /^ws/.test(p))
        .map((p) => p.replace(/^ws\//, ""));
      new AwsWebsocket(this, "aws-websocket", {
        name: safeProjectName,
        paths: wsPaths,
      });

      new AwsClerk(this, "aws_clerk", {
        zoneId: staticSite.route53ZoneIdOutput,
        clerkId: clerkDnsId,
      });

      new AwsEmail(this, "aws_email", {
        zoneId: staticSite.route53ZoneIdOutput,
        domain: projectName,
        inbound: false,
      });

      new ActionsSecret(this, "tf_aws_access_key", {
        repository: projectName,
        secretName: "TF_AWS_ACCESS_KEY",
        plaintextValue: aws_access_token.value,
      });

      new ActionsSecret(this, "tf_aws_access_secret", {
        repository: projectName,
        secretName: "TF_AWS_ACCESS_SECRET",
        plaintextValue: aws_secret_token.value,
      });

      const accessKey = new ActionsSecret(this, "deploy_aws_access_key", {
        repository: projectName,
        secretName: "DEPLOY_AWS_ACCESS_KEY",
        plaintextValue: staticSite.deployIdOutput,
      });

      const accessSecret = new ActionsSecret(this, "deploy_aws_access_secret", {
        repository: projectName,
        secretName: "DEPLOY_AWS_ACCESS_SECRET",
        plaintextValue: staticSite.deploySecretOutput,
      });

      new ActionsSecret(this, "lambda_aws_access_key", {
        repository: projectName,
        secretName: "LAMBDA_AWS_ACCESS_KEY",
        plaintextValue: updateLambdaKey.id,
      });

      new ActionsSecret(this, "lambda_aws_access_secret", {
        repository: projectName,
        secretName: "LAMBDA_AWS_ACCESS_SECRET",
        plaintextValue: updateLambdaKey.secret,
      });

      new ActionsSecret(this, "cloudfront_distribution_id", {
        repository: projectName,
        secretName: "CLOUDFRONT_DISTRIBUTION_ID",
        plaintextValue: staticSite.cloudfrontDistributionIdOutput,
      });
      allVariables.forEach((v) => {
        const tf_secret = new TerraformVariable(this, v, {
          type: "string",
        });
        new ActionsSecret(this, `${v}_secret`, {
          repository: projectName,
          secretName: v.toUpperCase(),
          plaintextValue: tf_secret.value,
        });
      });

      const samePageTestPassword = new TerraformVariable(
        this,
        "samepage_test_password",
        {
          type: "string",
        }
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
      new ActionsOrganizationSecret(this, `samepage_test_password_secret`, {
        visibility: "all",
        secretName: "SAMEPAGE_TEST_PASSWORD",
        plaintextValue: samePageTestPassword.value,
      });

      // TODO migrate google verification route53 record
      // - standard TXT record
      // - google._domainkey TXT record
      // - _dmarc TXT record
    }
  }

  const { data } = await octokit.rest.repos.listForOrg({
    org: "samepage-network",
  });
  const repos = data.filter((d) => /^\w+-samepage$/.test(d.name));
  const backendFunctionsByRepo = await repos
    .reduce(
      (p, c) =>
        p.then(async (prev) => {
          const paths = [];
          const apiSha = await octokit.repos
            .getContent({
              owner: "samepage-network",
              repo: c.name,
              path: ".",
            })
            .then((r) =>
              Array.isArray(r.data)
                ? r.data.find((f) => f.name === "api" && f.type === "dir")?.sha
                : null
            );
          if (apiSha) {
            const apiPaths = await octokit.git
              .getTree({
                owner: "samepage-network",
                repo: c.name,
                tree_sha: apiSha,
                recursive: "true",
              })
              .then((r) =>
                r.data.tree
                  .map((t) => t.path)
                  .filter((t): t is string => !!t && /\.ts$/.test(t))
              );
            paths.push(...apiPaths);
          }
          await octokit.repos
            .getContent({
              repo: c.name,
              owner: "samepage-network",
              path: "src/functions",
            })
            .then((r) => {
              if (Array.isArray(r.data) && r.data.length) {
                paths.push(...r.data.map((d) => `${d.name}/post`));
              }
            })
            .catch((e) => {
              if (e.status !== 404) throw e;
            });
          return paths.length
            ? [...prev, [c.name, paths] as [string, string[]]]
            : prev;
        }),
      Promise.resolve<[string, string[]][]>([])
    )
    .then((entries) => Object.fromEntries(entries));
  const app = new App();
  const stack = new MyStack(app, safeProjectName, { backendFunctionsByRepo });

  new RemoteBackend(stack, {
    hostname: "app.terraform.io",
    organization: "SamePage",
    workspaces: {
      name: safeProjectName,
    },
  });

  app.synth();
};

// If you ever need to move resources locally, here are the steps:
// - cd node_modules/cdktf.out/stacks/samepage-network
// - terraform init
// - move the state in the config
// - terraform state mv old new
setupInfrastructure().then(() =>
  process.env.TF_ONLY ? Promise.resolve() : compareSqlSchemas()
);
