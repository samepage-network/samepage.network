import { Construct } from "constructs";
import {
  App,
  Fn,
  RemoteBackend,
  TerraformStack,
  TerraformVariable,
  TerraformOutput,
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
import { ApiGatewayDomainName } from "@cdktf/provider-aws/lib/api-gateway-domain-name";
import { SnsTopic } from "@cdktf/provider-aws/lib/sns-topic";
import { SnsTopicSubscription } from "@cdktf/provider-aws/lib/sns-topic-subscription";
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
import { DataAwsIamUser } from "@cdktf/provider-aws/lib/data-aws-iam-user";
import { IamGroup } from "@cdktf/provider-aws/lib/iam-group";
import { IamUserPolicy } from "@cdktf/provider-aws/lib/iam-user-policy";
import { IamUserGroupMembership } from "@cdktf/provider-aws/lib/iam-user-group-membership";
import { IamAccessKey } from "@cdktf/provider-aws/lib/iam-access-key";
import { IamGroupPolicyAttachment } from "@cdktf/provider-aws/lib/iam-group-policy-attachment";
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
import { SesDomainIdentity } from "@cdktf/provider-aws/lib/ses-domain-identity";
import { SesDomainDkim } from "@cdktf/provider-aws/lib/ses-domain-dkim";
import { SesDomainMailFrom } from "@cdktf/provider-aws/lib/ses-domain-mail-from";
import { SesEmailIdentity } from "@cdktf/provider-aws/lib/ses-email-identity";
import { SesReceiptRuleSet } from "@cdktf/provider-aws/lib/ses-receipt-rule-set";
import { SesActiveReceiptRuleSet } from "@cdktf/provider-aws/lib/ses-active-receipt-rule-set";
import { SesReceiptRule } from "@cdktf/provider-aws/lib/ses-receipt-rule";
// TODO @deprecated
import { AwsWebsocket } from "@dvargas92495/aws-websocket";
// TODO @deprecated
import { AwsClerk } from "@dvargas92495/aws-clerk";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import readDir from "../package/scripts/internal/readDir";
import compareSqlSchemas from "./compareSqlSchemas";
import { Route53 } from "@aws-sdk/client-route-53";
import getCloudformationStackName from "../app/data/getCloudformationStackName.server";
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
        "convertkit_api_key",
        "staging_clerk_api_key",
        "staging_clerk_secret_key",
        "web3_storage_api_key",
        "stripe_webhook_secret",
        "svix_secret",
        "algolia_app_id",
        "algolia_admin_key",
        "ngrok_auth_token",
        "samepage_development_token",
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

      const AWS_REGION = "us-east-1";
      new AwsProvider(this, "AWS", {
        region: AWS_REGION,
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

      const mainWebsite = new S3BucketWebsiteConfiguration(
        this,
        "main_website",
        {
          indexDocument: {
            suffix: "index.html",
          },
          errorDocument: {
            key: "404.html",
          },
          bucket: buckets[projectName].id,
        }
      );

      new S3BucketCorsConfiguration(this, "main_cors", {
        bucket: buckets[projectName].id,
        corsRule: [
          {
            allowedHeaders: ["*"],
            allowedMethods: ["GET", "HEAD"],
            allowedOrigins: ["*"],
            exposeHeaders: [],
          },
        ],
      });

      const callerIdentity = new DataAwsCallerIdentity(this, "tf_caller", {});
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
            {
              actions: ["s3:PutObject"],

              resources: [`arn:aws:s3:::${buckets[projectName].id}/*`],

              principals: [
                {
                  type: "Service",
                  identifiers: ["ses.amazonaws.com"],
                },
              ],

              condition: [
                {
                  test: "StringEquals",
                  variable: "aws:Referer",
                  values: [callerIdentity.accountId],
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

      const redirectWebsite = new S3BucketWebsiteConfiguration(
        this,
        "redirect_website",
        {
          bucket: buckets[`www.${projectName}`].id,
          redirectAllRequestsTo: {
            hostName: projectName,
          },
        }
      );

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
              if (/\\/$/.test(olduri)) {
                const newuri = olduri + "index.html";
                request.uri = encodeURI(newuri);
              } else if (!/\\./.test(olduri)) {
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
        runtime: "nodejs18.x",
        publish: true,
        filename: "viewer-request.zip",
      });

      const originRequest = new LambdaFunction(this, "origin_request", {
        functionName: `${safeProjectName}_origin-request`,
        role: edgeLambdaRole.arn,
        handler: "origin-request.handler",
        runtime: "nodejs18.x",
        publish: false,
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
        [
          { domain: projectName, domainName: mainWebsite.websiteEndpoint },
          {
            domain: `www.${projectName}`,
            domainName: redirectWebsite.websiteEndpoint,
          },
        ].map(({ domain, domainName }, index) => [
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
                domainName,
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
        const lambdas = paths
          .filter((p) => !/^_[a-z]/.test(p))
          .map((p) => p.replace(/\.ts$/, ""));
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

      const cloudformationResourceArn = `arn:aws:cloudformation:${AWS_REGION}:${
        callerIdentity.accountId
      }:stack/${getCloudformationStackName("*")}/*`;

      const websitePublishingTopic = new SnsTopic(
        this,
        "website_publishing_topic",
        {
          name: "website-publishing-topic",
        }
      );

      new SnsTopicSubscription(this, "website_publishing_topic_subscription", {
        topicArn: websitePublishingTopic.arn,
        protocol: "lambda",
        endpoint: `arn:aws:lambda:${AWS_REGION}:${callerIdentity.accountId}:function:samepage-network_snsubcriber`,
      });

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
                "execute-api:Invoke",
                "execute-api:ManageConnections",
                "lambda:InvokeFunction",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:CreateLogGroup",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:ListObjectsV2",
                "s3:PutObject",
                "s3:DeleteObject",
                "ses:sendEmail",
                "route53:ListResourceRecordSets",
                "route53:ChangeResourceRecordSets",
                "route53:ListHostedZones",
                "route53:GetChange",
              ],
              resources: ["*"],
            },
            {
              actions: ["sts:AssumeRole"],
              resources: [
                `arn:aws:iam::${callerIdentity.accountId}:role/${safeProjectName}-lambda-execution`,
              ],
            },
            {
              actions: [
                "cloudformation:CreateStack",
                "cloudformation:DeleteStack",
                "cloudformation:DescribeStacks",
                "cloudformation:UpdateStack",
                "cloudformation:ListStackResources",
              ],
              resources: [cloudformationResourceArn],
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
                `arn:aws:lambda:${AWS_REGION}:${callerIdentity.accountId}:function:samepage-network_*`,
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
                `arn:aws:lambda:${AWS_REGION}:${callerIdentity.accountId}:function:samepage-network_extensions-*`,
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

      const assumeCloudformationPolicy = new DataAwsIamPolicyDocument(
        this,
        "assume_cloudformation_policy",
        {
          statement: [
            {
              actions: ["sts:AssumeRole"],
              principals: [
                {
                  type: "Service",
                  identifiers: ["cloudformation.amazonaws.com"],
                },
              ],
            },
          ],
        }
      );

      const cloudformationRole = new IamRole(this, "cloudformation_role", {
        name: `${safeProjectName}-cloudformation`,
        assumeRolePolicy: assumeCloudformationPolicy.json,
      });

      const originLambdaArn = `arn:aws:lambda:${AWS_REGION}:${callerIdentity.accountId}:function:${safeProjectName}_origin`;
      const cloudformationRolePolicyDocument = new DataAwsIamPolicyDocument(
        this,
        "cloudformation_role_policy_document",
        {
          statement: [
            {
              actions: ["SNS:Publish"],
              resources: [websitePublishingTopic.arn],
            },
            {
              actions: ["route53:CreateHostedZone"],
              resources: ["*"],
            },
            {
              actions: ["lambda:GetFunction", "lambda:EnableReplication*"],
              resources: [`${originLambdaArn}:*`, originLambdaArn],
            },
          ],
        }
      );

      const lambdaTimeouts: Record<string, number> = { origin: 30 };

      new IamRolePolicy(this, "cloudformation_role_policy", {
        name: `${safeProjectName}-cloudformation`,
        role: cloudformationRole.name,
        policy: cloudformationRolePolicyDocument.json,
      });

      new IamRolePolicyAttachment(this, "cloudformation_s3_full_access", {
        role: cloudformationRole.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonRoute53FullAccess",
      });

      new IamRolePolicyAttachment(this, "cloudformation_acm_full_access", {
        role: cloudformationRole.name,
        policyArn: "arn:aws:iam::aws:policy/AWSCertificateManagerFullAccess",
      });

      new IamRolePolicyAttachment(this, "cloudformation_cf_full_access", {
        role: cloudformationRole.name,
        policyArn: "arn:aws:iam::aws:policy/CloudFrontFullAccess",
      });

      new IamRolePolicyAttachment(this, "cloudformation_cw_full_access", {
        role: cloudformationRole.name,
        policyArn: "arn:aws:iam::aws:policy/CloudWatchFullAccess",
      });

      const launchWebsitePolicyDocument = new DataAwsIamPolicyDocument(
        this,
        "launch_website_policy_document",
        {
          statement: [
            {
              actions: ["iam:PassRole"],
              resources: [cloudformationRole.arn],
            },
          ],
        }
      );

      const launchWebsitePolicy = new IamPolicy(this, "launch_website_policy", {
        name: `${safeProjectName}-launch-website`,
        policy: launchWebsitePolicyDocument.json,
      });

      const vargasUser = new DataAwsIamUser(this, "vargas_user", {
        userName: "vargas",
      });

      const adminGroup = new IamGroup(this, "admin_user_group", {
        name: `${safeProjectName}-admin`,
        path: "/",
      });

      new IamUserGroupMembership(this, "admin_user_membership", {
        groups: [adminGroup.name],
        user: vargasUser.userName,
      });

      new IamGroupPolicyAttachment(this, "admin_group_website_policy", {
        group: adminGroup.name,
        policyArn: launchWebsitePolicy.arn,
      });

      new IamGroupPolicyAttachment(this, "admin_group_execution_policy", {
        group: adminGroup.name,
        policyArn: lamdaExecutionPolicy.arn,
      });

      const launchWebsiteLambdaRole = new IamRole(
        this,
        "launch_website_lambda_role",
        {
          name: `${safeProjectName}-launch-website-lambda`,
          assumeRolePolicy: assumeLambdaPolicy.json,
        }
      );

      new IamRolePolicyAttachment(
        this,
        "launch_website_lambda_role_attachment",
        {
          role: launchWebsiteLambdaRole.name,
          policyArn: launchWebsitePolicy.arn,
        }
      );

      new IamRolePolicyAttachment(
        this,
        "launch_website_lambda_role_base_attachment",
        {
          role: launchWebsiteLambdaRole.name,
          policyArn: lamdaExecutionPolicy.arn,
        }
      );

      const lambdaRoleMapping: Record<string, IamRole> = {
        launch: launchWebsiteLambdaRole,
        origin: edgeLambdaRole,
      };

      const lambdaFunctions = Object.fromEntries(
        allLambdas.map((lambdaPath) => [
          lambdaPath,
          new LambdaFunction(
            this,
            `lambda_function_${lambdaPath.replace(/\//g, "_")}`,
            {
              functionName: `${safeProjectName}_${functionNames[lambdaPath]}`,
              role: (lambdaRoleMapping[lambdaPath] ?? lambdaRole).arn,
              handler: `${functionNames[lambdaPath]}.handler`,
              filename: dummyFile.outputPath,
              runtime: "nodejs18.x",
              publish: false,
              timeout: lambdaTimeouts[lambdaPath] ?? 60,
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
      new LambdaPermission(this, `sns_lambda_permission`, {
        statementId: "AllowExecutionFromSNS",
        action: "lambda:InvokeFunction",
        functionName: lambdaFunctions["snsubcriber"].functionName,
        principal: "sns.amazonaws.com",
        sourceArn: websitePublishingTopic.arn,
      });

      const distinctResources = Array.from(new Set(Object.values(resources)));
      const mockMethods = Object.fromEntries(
        distinctResources.map((resource) => [
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
        distinctResources.map((resource) => [
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
        distinctResources.map((resource) => [
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
      const mockIntegrationResponses = distinctResources.map(
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

      new ActionsSecret(this, "sns_topic_arn_secret", {
        repository: projectName,
        secretName: "SNS_TOPIC_ARN",
        plaintextValue: websitePublishingTopic.arn,
      });

      new ActionsSecret(this, "remix_cache_policy_id", {
        repository: projectName,
        secretName: "REMIX_CACHE_POLICY_ID",
        plaintextValue: cachePolicy.id,
      });

      new ActionsSecret(this, "cloudformation_role_arn", {
        repository: projectName,
        secretName: "CLOUDFORMATION_ROLE_ARN",
        plaintextValue: cloudformationRole.arn,
      });

      const originQarn = lambdaFunctions["origin"].qualifiedArn;
      new ActionsSecret(this, "website_publishing_lambda_arn", {
        repository: projectName,
        secretName: "WEBSITE_PUBLISHING_LAMBDA_ARN",
        plaintextValue: originQarn,
      });

      const s3WebsiteEndpoint = mainWebsite.websiteEndpoint.replace(
        /^https:\/\//,
        ""
      );
      new ActionsSecret(this, "s3_website_endpoint", {
        repository: projectName,
        secretName: "S3_WEBSITE_ENDPOINT",
        plaintextValue: s3WebsiteEndpoint,
      });

      new ActionsSecret(this, "cloudfront_secret", {
        repository: projectName,
        secretName: "CLOUDFRONT_SECRET",
        plaintextValue: secret.value,
      });

      new TerraformOutput(this, "cloudfront_hosted_zone_id", {
        value: distributions[projectName].hostedZoneId,
      });

      new TerraformOutput(this, "website_publishing_lambda_arn_output", {
        value: originQarn,
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

      new GithubProvider(this, "personal_provider", {
        token: process.env.GITHUB_TOKEN,
        owner: "dvargas92495",
        alias: "personal",
      });
      const roamjsGithubProvider = new GithubProvider(this, "roamjs_provider", {
        token: process.env.ROAMJS_GITHUB_TOKEN,
        owner: "RoamJS",
        alias: "roamjs",
      });
      new ActionsOrganizationSecret(this, "roamjs_aws_access_key", {
        provider: roamjsGithubProvider,
        secretName: "AWS_ACCESS_KEY_ID",
        plaintextValue: appKey.id,
        visibility: "all",
      });
      new ActionsOrganizationSecret(this, "roamjs_aws_access_secret", {
        provider: roamjsGithubProvider,
        secretName: "AWS_SECRET_ACCESS_KEY",
        plaintextValue: appKey.secret,
        visibility: "all",
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
        const tfVariable = new TerraformVariable(this, v, {
          type: "string",
        });
        const tfSecret = new ActionsSecret(this, `${v}_secret`, {
          repository: projectName,
          secretName: v.toUpperCase(),
          plaintextValue: tfVariable.value,
        });
        return [v, { tfVariable, tfSecret }];
      });

      new ActionsSecret(this, "samepage_zone_id", {
        repository: projectName,
        secretName: "SAMEPAGE_HOSTED_ZONE_ID",
        plaintextValue: zoneId,
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
      const clerkSecretKey = new TerraformVariable(this, "clerk_secret_key", {
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
      new ActionsOrganizationSecret(this, `clerk_publishable_key_secret`, {
        visibility: "all",
        secretName: "CLERK_PUBLISHABLE_KEY",
        plaintextValue: clerkPublishableKey.value,
      });
      new ActionsOrganizationSecret(this, `clerk_secret_key_secret`, {
        visibility: "all",
        secretName: "CLERK_SECRET_KEY",
        plaintextValue: clerkSecretKey.value,
      });

      new Route53Record(this, `github_txt_record`, {
        name: "_github-challenge-samepage-network-org.samepage.network.",
        type: "TXT",
        zoneId,
        records: ["4b935591d3"],
        ttl: 300,
      });

      const domainIdentity = new SesDomainIdentity(
        this,
        `ses_domain_identity`,
        {
          domain: projectName,
        }
      );

      const domainDkim = new SesDomainDkim(this, `ses_domain_dkim`, {
        domain: domainIdentity.domain,
      });

      const mailFromDomain = `admin.${projectName}`;

      new SesDomainMailFrom(this, `ses_domain_mail_from`, {
        domain: projectName,
        mailFromDomain,
      });

      new Route53Record(this, `ses_verification_record`, {
        zoneId,
        name: `_amazonses.${domainIdentity.domain}`,
        type: "TXT",
        ttl: 1800,
        records: [domainIdentity.verificationToken],
      });

      Array(3)
        .fill(null)
        .forEach(
          (_, index) =>
            new Route53Record(this, `dkim_record_${index}`, {
              zoneId,
              name: `${Fn.element(domainDkim.dkimTokens, index)}._domainkey.${
                domainIdentity.domain
              }`,
              type: "CNAME",
              ttl: 1800,
              records: [
                `${Fn.element(
                  domainDkim.dkimTokens,
                  index
                )}.dkim.amazonses.com`,
              ],
            })
        );

      new Route53Record(this, `mail_from_txt_record`, {
        zoneId,
        name: mailFromDomain,
        type: "TXT",
        ttl: 300,
        records: ["v=spf1 include:amazonses.com ~all"],
      });

      new Route53Record(this, `mail_from_mx_record`, {
        zoneId,
        name: mailFromDomain,
        type: "MX",
        ttl: 1800,
        records: ["10 feedback-smtp.us-east-1.amazonaws.com"],
      });

      new SesEmailIdentity(this, "identity", {
        email: `support@${projectName}`,
      });

      new Route53Record(this, `google_mx_record`, {
        zoneId,
        name: projectName,
        type: "MX",
        ttl: 300,
        records: [
          "1 ASPMX.L.GOOGLE.COM.",
          "5 ALT1.ASPMX.L.GOOGLE.COM.",
          "5 ALT2.ASPMX.L.GOOGLE.COM.",
          "10 ALT3.ASPMX.L.GOOGLE.COM.",
          "10 ALT4.ASPMX.L.GOOGLE.COM.",
          "20 inbound-smtp.us-east-1.amazonaws.com",
        ],
      });

      new Route53Record(this, `standard_txt_record`, {
        zoneId,
        name: projectName,
        type: "TXT",
        ttl: 300,
        records: ["v=spf1 include:_spf.google.com ~all"],
      });

      new Route53Record(this, `google_domain_txt_record`, {
        zoneId,
        name: `google._domainkey.${projectName}`,
        type: "TXT",
        ttl: 300,
        records: [
          'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAisRL3yxr04856dcN7R9bbLqtKrZKK3QbyuwffAzJ8ZDQPYDRa7qjazJeNO4NDGk++lhfySBSn8aJ56KhLDcd+e7BaM0Hx/RezWCQEk0YYZiDeD1C5z+Rt6Hu9w8VVFIogmcNNFNJ2arS4AUUX""rPnr1RnIaf2C6oj2iNgxiCDCKsXNmwUV7fpHtVA8lxpG/tbn88j5DZdnUPY5qksuW+D+Ct1vQnQEZjntexBUsr6EY2JKQZq/IkACnhbRZdhJBk1eXDyGQ5vQF9O9iYOSzgxtDiwPeZXFxV+fHyaY97amLN8voxyuFMR6CmR2qKfq5HrZFKOalRSOnM+rs7p4Yp91QIDAQAB',
        ],
      });

      new Route53Record(this, `dmarc_txt_record`, {
        zoneId,
        name: `_dmarc.${projectName}`,
        type: "TXT",
        ttl: 300,
        records: ["v=DMARC1; p=none; rua=mailto:support@samepage.network"],
      });

      const sesReceiptRuleSet = new SesReceiptRuleSet(
        this,
        `receipt_rule_set`,
        {
          ruleSetName: "samepage-rules",
        }
      );
      new SesActiveReceiptRuleSet(this, `active_receipt_rule_set`, {
        ruleSetName: sesReceiptRuleSet.ruleSetName,
      });
      new SesReceiptRule(this, `email_s3_rule`, {
        ruleSetName: sesReceiptRuleSet.ruleSetName,
        name: "store",
        recipients: [],
        enabled: true,
        scanEnabled: true,
        s3Action: [
          {
            bucketName: buckets[projectName].bucket,
            position: 1,
            objectKeyPrefix: "emails/",
          },
        ],
      });
    }
  }

  const { data } = await octokit.rest.repos.listForOrg({
    org: "samepage-network",
  });
  const repos = data
    .filter((d) => /^\w+-samepage$/.test(d.name))
    .map((d) => ({
      name: d.name,
      owner: d.owner.login,
    }));
  const backendFunctionsByRepo = await repos
    .reduce(
      (p, c) =>
        p.then(async (prev) => {
          const paths = [];
          const apiSha = await octokit.repos
            .getContent({
              owner: c.owner,
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
                owner: c.owner,
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
    {
      from: "module.aws_email.aws_ses_domain_identity.domain",
      to: "aws_ses_domain_identity.ses_domain_identity",
    },
    {
      from: "module.aws_email.aws_ses_domain_dkim.domain",
      to: "aws_ses_domain_dkim.ses_domain_dkim",
    },
    {
      from: "module.aws_email.aws_ses_domain_mail_from.domain",
      to: "aws_ses_domain_mail_from.ses_domain_mail_from",
    },
    {
      from: "module.aws_email.aws_route53_record.ses_verification_record",
      to: "aws_route53_record.ses_verification_record",
    },
    {
      from: "module.aws_email.aws_route53_record.dkim_record[0]",
      to: "aws_route53_record.dkim_record_0",
    },
    {
      from: "module.aws_email.aws_route53_record.dkim_record[1]",
      to: "aws_route53_record.dkim_record_1",
    },
    {
      from: "module.aws_email.aws_route53_record.dkim_record[2]",
      to: "aws_route53_record.dkim_record_2",
    },
    {
      from: "module.aws_email.aws_route53_record.mail_from_txt_record",
      to: "aws_route53_record.mail_from_txt_record",
    },
    {
      from: "module.aws_email.aws_route53_record.mail_from_mx_record",
      to: "aws_route53_record.mail_from_mx_record",
    },
    {
      from: "module.aws_email.aws_ses_email_identity.identity",
      to: "aws_ses_email_identity.identity",
    },
  ]);
  const zoneId = await new Route53({})
    .listHostedZones({})
    .then((r) =>
      r.HostedZones?.find((hs) =>
        hs.Name?.includes("samepage.network")
      )?.Id?.replace("/hostedzone/", "")
    );
  if (!zoneId) throw new Error("No zone id found");
  stack.addOverride("import", [
    {
      to: "aws_route53_record.google_mx_record",
      id: `${zoneId}_samepage.network_MX`,
    },
    {
      to: "aws_route53_record.standard_txt_record",
      id: `${zoneId}_samepage.network_TXT`,
    },
    {
      to: "aws_route53_record.dmarc_txt_record",
      id: `${zoneId}__dmarc.samepage.network_TXT`,
    },
    {
      to: "aws_route53_record.google_domain_txt_record",
      id: `${zoneId}_google._domainkey.samepage.network_TXT`,
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
