import { Construct } from "constructs";
import {
  App,
  Fn,
  RemoteBackend,
  // TerraformIterator,
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
import { IamRolePolicy } from "@cdktf/provider-aws/lib/iam-role-policy";
import { IamUser } from "@cdktf/provider-aws/lib/iam-user";
import { IamUserPolicy } from "@cdktf/provider-aws/lib/iam-user-policy";
import { IamAccessKey } from "@cdktf/provider-aws/lib/iam-access-key";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { DataAwsIamPolicyDocument } from "@cdktf/provider-aws/lib/data-aws-iam-policy-document";
import { DataAwsCallerIdentity } from "@cdktf/provider-aws/lib/data-aws-caller-identity";
import { GithubProvider } from "@cdktf/provider-github/lib/provider";
import { ActionsSecret } from "@cdktf/provider-github/lib/actions-secret";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketWebsiteConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-website-configuration";
import { S3BucketCorsConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-cors-configuration";
import { S3BucketPolicy } from "@cdktf/provider-aws/lib/s3-bucket-policy";
import { DataAwsRoute53Zone } from "@cdktf/provider-aws/lib/data-aws-route53-zone";
import { DataAwsCloudfrontOriginRequestPolicy } from "@cdktf/provider-aws/lib/data-aws-cloudfront-origin-request-policy";
import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { CloudfrontOriginAccessIdentity } from "@cdktf/provider-aws/lib/cloudfront-origin-access-identity";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
// TODO @deprecated
import { AwsWebsocket } from "@dvargas92495/aws-websocket";
// TODO @deprecated
import { AwsClerk } from "@dvargas92495/aws-clerk";
// TODO @deprecated
import { AwsEmail } from "@dvargas92495/aws-email";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import readDir from "../package/scripts/internal/readDir";
import compareSqlSchemas from "./compareSqlSchemas";
dotenv.config({ override: true });

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
        "clerk_secret_key",
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

      new AwsProvider(this, "AWS", {
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

      const { zoneId } = new DataAwsRoute53Zone(this, "zone", {
        name: "samepage.network.",
      });

      const buckets: Record<string, S3Bucket> = {
        [projectName]: new S3Bucket(this, "main", {
          bucket: projectName,
          forceDestroy: true,
        }),
      };

      new S3BucketWebsiteConfiguration(this, "main_website", {
        indexDocument: {
          suffix: "index.html",
        },
        errorDocument: {
          key: "404.html",
        },
        bucket: buckets[projectName].id,
      });

      new S3BucketCorsConfiguration(this, "main_cors", {
        bucket: buckets[projectName].id,
        corsRule: [
          {
            allowedHeaders: ["*"],
            allowedMethods: ["GET"],
            allowedOrigins: ["*"],
            exposeHeaders: [],
          },
        ],
      });

      const mainBucketPolicy = new DataAwsIamPolicyDocument(
        this,
        "main_bucket_policy_doc",
        {
          statement: [
            {
              actions: ["s3:GetObject"],

              resources: [`${buckets[projectName].arn}/*`],

              condition: [
                {
                  test: "StringLike",
                  variable: "aws:Referer",

                  values: [secret.value],
                },
              ],

              principals: [
                {
                  type: "AWS",
                  identifiers: ["*"],
                },
              ],
            },
          ],
        }
      );

      new S3BucketPolicy(this, "main_bucket_policy", {
        bucket: buckets[projectName].id,
        policy: mainBucketPolicy.json,
      });

      buckets[`www.${projectName}`] = new S3Bucket(this, "redirect_bucket", {
        bucket: "www.samepage.network",
        forceDestroy: true,
      });

      new S3BucketWebsiteConfiguration(this, "redirect_website", {
        bucket: buckets[`www.${projectName}`].id,
        redirectAllRequestsTo: {
          hostName: projectName,
        },
      });

      const webCert = new AcmCertificate(this, "cert", {
        domainName: projectName,
        subjectAlternativeNames: [`www.${projectName}`],
        validationMethod: "DNS",

        lifecycle: {
          createBeforeDestroy: true,
        },
      });

      const webCertRecord = [projectName, `www.${projectName}`].map(
        (_, index) =>
          new Route53Record(
            this,
            index === 0 ? "cert_record" : "cert_record_www",
            {
              name: webCert.domainValidationOptions.get(index)
                .resourceRecordName,
              type: webCert.domainValidationOptions.get(index)
                .resourceRecordType,
              records: [
                webCert.domainValidationOptions.get(index).resourceRecordValue,
              ],
              zoneId,
              ttl: 300,
            }
          )
      );

      const webCertValidation = new AcmCertificateValidation(
        this,
        "cert_validation",
        {
          certificateArn: webCert.arn,
          validationRecordFqdns: webCertRecord.map((c) => c.fqdn),

          timeouts: {
            create: "2h",
          },
        }
      );

      const reqPolicy = new DataAwsCloudfrontOriginRequestPolicy(
        this,
        "origin_policy",
        {
          name: "Managed-AllViewer",
        }
      );

      const assumeLambdaEdgePolicy = new DataAwsIamPolicyDocument(
        this,
        "assume_lambda_edge_policy",
        {
          statement: [
            {
              actions: ["sts:AssumeRole"],
              principals: [
                {
                  type: "Service",
                  identifiers: [
                    "lambda.amazonaws.com",
                    "edgelambda.amazonaws.com",
                  ],
                },
              ],
            },
          ],
        }
      );

      const edgeLambdaRole = new IamRole(this, "cloudfront_lambda", {
        name: `${safeProjectName}-lambda-cloudfront`,
        assumeRolePolicy: assumeLambdaEdgePolicy.json,
      });

      new DataArchiveFile(this, "viewer-request-default", {
        type: "zip",
        outputPath: "./viewer-request.zip",
        source: [
          {
            content:
              "module.exports.handler = (e, _, c) => c(null, e.Records[0].cf.request)",
            filename: "viewer-request.js",
          },
        ],
      });

      new DataArchiveFile(this, "origin-request-default", {
        type: "zip",
        outputPath: "./origin-request.zip",

        source: [
          {
            content: `module.exports.handler = (event, _, c) => {
              const request = event.Records[0].cf.request;
              const olduri = request.uri;
              if (/\/$/.test(olduri)) {
                const newuri = olduri + "index.html";
                request.uri = encodeURI(newuri);
              } else if (!/\./.test(olduri)) {
                const newuri = olduri + ".html";
                request.uri = encodeURI(newuri);
              }
              c(null, request);
            }`,
            filename: "origin-request.js",
          },
        ],
      });

      const viewerRequest = new LambdaFunction(this, "viewer_request", {
        functionName: `${safeProjectName}_viewer-request`,
        role: edgeLambdaRole.arn,
        handler: "viewer-request.handler",
        runtime: "nodejs16.x",
        publish: true,
        filename: "viewer-request.zip",
      });

      const originRequest = new LambdaFunction(this, "origin_request", {
        functionName: `${safeProjectName}_origin-request`,
        role: edgeLambdaRole.arn,
        handler: "origin-request.handler",
        runtime: "nodejs16.x",
        publish: true,
        filename: "origin-request.zip",
        timeout: 20,
        memorySize: 5120,
      });

      const logsPolicyDoc = new DataAwsIamPolicyDocument(
        this,
        "lambda_logs_policy_doc",
        {
          statement: [
            {
              effect: "Allow",
              resources: ["*"],
              actions: [
                "cloudfront:CreateInvalidation",
                "cloudfront:GetInvalidation",
                "cloudfront:ListDistributions",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents",
                "lambda:InvokeFunction",
                "s3:DeleteObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:PutObject",
                "ses:sendEmail",
              ],
            },
          ],
        }
      );

      new IamRolePolicy(this, "logs_role_policy", {
        name: `${safeProjectName}-lambda-cloudfront`,
        role: edgeLambdaRole.id,
        policy: logsPolicyDoc.json,
      });

      const distributions = Object.fromEntries(
        [projectName, `www.${projectName}`].map((domain, index) => [
          domain,
          new CloudfrontDistribution(this, index === 0 ? "cdn" : "cdn_www", {
            aliases: [domain],
            comment: `CloudFront CDN for ${domain}`,
            enabled: true,
            isIpv6Enabled: true,
            priceClass: "PriceClass_All",

            origin: [
              {
                originId: `S3-${domain}`,

                // START LEGACY
                domainName: buckets[domain].websiteEndpoint,
                customOriginConfig: {
                  originProtocolPolicy: "http-only",
                  httpPort: 80,
                  httpsPort: 443,
                  originSslProtocols: ["TLSv1", "TLSv1.2"],
                },
                customHeader: [
                  {
                    name: "Referer",
                    value: secret.value,
                  },
                ],

                /*
          domain_name = count.index == 0 ? aws_s3_bucket.main.bucket_domain_name : aws_s3_bucket.redirect[local.redirect_domains[count.index - 1]].bucket_domain_name
          s3_origin_config {
            origin_access_identity = aws_cloudfront_origin_access_identity.cdn.cloudfront_access_identity_path
          }
    */ // END LEGACY
              },
            ],

            restrictions: {
              geoRestriction: {
                restrictionType: "none",
                locations: [],
              },
            },

            viewerCertificate: {
              acmCertificateArn: webCert.arn,
              sslSupportMethod: "sni-only",
              minimumProtocolVersion: "TLSv1_2016",
            },

            defaultCacheBehavior: {
              allowedMethods: [
                "GET",
                "HEAD",
                "OPTIONS",
                "PUT",
                "POST",
                "PATCH",
                "DELETE",
              ],
              cachedMethods: ["GET", "HEAD", "OPTIONS"],
              targetOriginId: `S3-${domain}`,
              compress: true,
              viewerProtocolPolicy: "redirect-to-https",
              cachePolicyId: cachePolicy.id,
              originRequestPolicyId: reqPolicy.id,
              lambdaFunctionAssociation:
                index == 0
                  ? [
                      {
                        eventType: "viewer-request",
                        lambdaArn: viewerRequest.qualifiedArn,
                        includeBody: false,
                      },
                      {
                        eventType: "origin-request",
                        lambdaArn: originRequest.qualifiedArn,
                        includeBody: true,
                      },
                    ]
                  : [],
            },
            dependsOn: [webCertValidation],
          }),
        ])
      );

      [projectName, `www.${projectName}`].map(
        (domain, index) =>
          new Route53Record(this, index === 0 ? "A" : "A_www", {
            zoneId,
            type: "A",
            name: domain,
            alias: [
              {
                name: distributions[domain].domainName,
                zoneId: distributions[domain].hostedZoneId,
                evaluateTargetHealth: false,
              },
            ],
          })
      );

      [projectName, `www.${projectName}`].map(
        (domain, index) =>
          new Route53Record(this, index === 0 ? "AAAA" : "AAAA_www", {
            zoneId,
            type: "AAAA",
            name: domain,
            alias: [
              {
                name: distributions[domain].domainName,
                zoneId: distributions[domain].hostedZoneId,
                evaluateTargetHealth: false,
              },
            ],
          })
      );

      new CloudfrontOriginAccessIdentity(this, "cdn_identity", {
        comment: "Identity for CloudFront only access",
      });
      const callerIdentity = new DataAwsCallerIdentity(this, "tf_caller", {});

      const appUser = new IamUser(this, "app_deploy_user", {
        name: `${projectName}-deploy`,
        path: "/",
      });
      const appKey = new IamAccessKey(this, "app_deploy_key", {
        user: appUser.name,
      });

      const appDeployPolicy = new DataAwsIamPolicyDocument(
        this,
        "app_deploy_policy_doc",
        {
          statement: [
            {
              actions: ["s3:ListBucket"],

              resources: [buckets[projectName].arn],
            },
            {
              actions: [
                "s3:DeleteObject",
                "s3:GetObject",
                "s3:GetObjectAcl",
                "s3:ListBucket",
                "s3:PutObject",
                "s3:PutObjectAcl",
              ],

              resources: [`${buckets[projectName].arn}/*`],
            },
            {
              actions: ["cloudfront:ListDistributions"],

              resources: [
                `arn:aws:cloudfront::${callerIdentity.accountId}:distribution`,
              ],
            },
            {
              actions: [
                "cloudfront:CreateInvalidation",
                "cloudfront:GetInvalidation",
                "cloudfront:UpdateDistribution",
                "cloudfront:GetDistribution",
              ],

              resources: [distributions[projectName].arn],
            },
            {
              actions: [
                "lambda:UpdateFunctionCode",
                "lambda:GetFunction",
                "lambda:EnableReplication*",
              ],

              resources: [
                originRequest.arn,
                viewerRequest.arn,
                `${originRequest.arn}:*`,
                `${viewerRequest.arn}:*`,
              ],
            },
          ],
        }
      );

      new IamUserPolicy(this, "app_deploy_policy", {
        name: "deploy",
        user: appUser.name,
        policy: appDeployPolicy.json,
      });

      /* New way to securely connect S3 to CloudFront exploration
data "aws_iam_policy_document" "bucket_policy" {
  statement {
    actions:[
      "s3:GetObject",
    ]

    resources = ["${aws_s3_bucket.main.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = [
        aws_cloudfront_origin_access_identity.cdn.iam_arn
      ]
    }
  }
}

resource "aws_s3_bucket_policy" "bucket_policy" {
  bucket = aws_s3_bucket.main.id
  policy = data.aws_iam_policy_document.bucket_policy.json
}
*/

      const httpMethods = new Set([
        "get",
        "post",
        "put",
        "delete",
        "patch",
        "options",
        "head",
      ]);
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
      const resourceLambdas = allLambdas.filter((p) =>
        httpMethods.has(pathParts[p].slice(-1)[0])
      );
      const resources = Object.fromEntries(
        resourceLambdas.map((p) => [p, pathParts[p].slice(0, -1).join("/")])
      );
      const methods = Object.fromEntries(
        resourceLambdas.map((p) => [p, pathParts[p].slice(-1)[0]])
      );

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
          resources[p]
            ? `${resources[p].replace(/\//g, "-")}_${methods[p]}`
            : p.replace(/\//g, "-"),
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
              memorySize: 5120,
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
        zoneId,
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
        zoneId,
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
        zoneId,
        clerkId: clerkDnsId,
      });

      new AwsEmail(this, "aws_email", {
        zoneId,
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
        plaintextValue: appKey.id,
      });

      const accessSecret = new ActionsSecret(this, "deploy_aws_access_secret", {
        repository: projectName,
        secretName: "DEPLOY_AWS_ACCESS_SECRET",
        plaintextValue: appKey.secret,
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
        plaintextValue: distributions[projectName].id,
      });
      allVariables.map((v) => {
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
      const clerkPublishableKey = new TerraformVariable(
        this,
        "clerk_publishable_key",
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
      new ActionsOrganizationSecret(this, `clerk_publishable_key_secret`, {
        visibility: "all",
        secretName: "CLERK_PUBLISHABLE_KEY",
        plaintextValue: clerkPublishableKey.value,
      });

      
      // TODO migrate google verification route53 record
      // - github txt new Route53Record()
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
                paths.push(
                  ...r.data.map((d) => `${d.name.replace(/\.ts$/, "")}/post`)
                );
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
  stack.addOverride("moved", [
    {
      from: "module.aws_static_site.aws_s3_bucket.main",
      to: "aws_s3_bucket.main",
    },
    {
      from: "module.aws_static_site.aws_s3_bucket_website_configuration.main_website",
      to: "aws_s3_bucket_website_configuration.main_website",
    },
    {
      from: "module.aws_static_site.aws_s3_bucket_cors_configuration.main_cors",
      to: "aws_s3_bucket_cors_configuration.main_cors",
    },
    {
      from: "module.aws_static_site.aws_s3_bucket_policy.bucket_policy",
      to: "aws_s3_bucket_policy.main_bucket_policy",
    },
    {
      from: 'module.aws_static_site.aws_s3_bucket.redirect["www.samepage.network"]',
      to: "aws_s3_bucket.redirect_bucket",
    },
    {
      from: 'module.aws_static_site.aws_s3_bucket_website_configuration.redirect_website["www.samepage.network"]',
      to: "aws_s3_bucket_website_configuration.redirect_website",
    },
    {
      from: "module.aws_static_site.aws_acm_certificate.cert",
      to: "aws_acm_certificate.cert",
    },
    {
      from: "module.aws_static_site.aws_route53_record.cert[0]",
      to: "aws_route53_record.cert_record",
    },
    {
      from: "module.aws_static_site.aws_route53_record.cert[1]",
      to: "aws_route53_record.cert_record_www",
    },
    {
      from: "module.aws_static_site.aws_acm_certificate_validation.cert",
      to: "aws_acm_certificate_validation.cert_validation",
    },
    {
      from: "module.aws_static_site.aws_iam_role.cloudfront_lambda",
      to: "aws_iam_role.cloudfront_lambda",
    },
    {
      from: "module.aws_static_site.aws_lambda_function.viewer_request",
      to: "aws_lambda_function.viewer_request",
    },
    {
      from: "module.aws_static_site.aws_lambda_function.origin_request",
      to: "aws_lambda_function.origin_request",
    },
    {
      from: "module.aws_static_site.aws_iam_role_policy.logs_role_policy",
      to: "aws_iam_role_policy.logs_role_policy",
    },
    {
      from: "module.aws_static_site.aws_cloudfront_distribution.cdn[0]",
      to: "aws_cloudfront_distribution.cdn",
    },
    {
      from: "module.aws_static_site.aws_cloudfront_distribution.cdn[1]",
      to: "aws_cloudfront_distribution.cdn_www",
    },
    {
      from: "module.aws_static_site.aws_cloudfront_origin_access_identity.cdn",
      to: "aws_cloudfront_origin_access_identity.cdn_identity",
    },
    {
      from: "module.aws_static_site.aws_iam_user.deploy[0]",
      to: "aws_iam_user.app_deploy_user",
    },
    {
      from: "module.aws_static_site.aws_iam_access_key.deploy[0]",
      to: "aws_iam_access_key.app_deploy_key",
    },
    {
      from: "module.aws_static_site.aws_iam_user_policy.deploy[0]",
      to: "aws_iam_user_policy.app_deploy_policy",
    },
    {
      from: "module.aws_static_site.aws_route53_record.A[0]",
      to: "aws_route53_record.A",
    },
    {
      from: "module.aws_static_site.aws_route53_record.AAAA[0]",
      to: "aws_route53_record.AAAA",
    },
    {
      from: "module.aws_static_site.aws_route53_record.A[1]",
      to: "aws_route53_record.A_www",
    },
    {
      from: "module.aws_static_site.aws_route53_record.AAAA[1]",
      to: "aws_route53_record.AAAA_www",
    },
  ]);

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
