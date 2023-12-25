import {
  CloudFormation,
  CreateStackCommandInput,
} from "@aws-sdk/client-cloudformation";
import { users } from "@clerk/clerk-sdk-node";
import { Handler } from "aws-lambda";
import { websites } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import emailError from "package/backend/emailError.server";
import uploadFileContent from "package/backend/uploadFileContent";
import { Json } from "package/internal/types";
import parseZodError from "package/utils/parseZodError";
import { z } from "zod";
import getCloudformationStackName from "~/data/getCloudformationStackName.server";
import isSystemDomain from "~/data/isSystemDomain.server";
import logWebsiteStatus from "~/data/logWebsiteStatus.server";
import getMysql from "~/data/mysql.server";

// Remix Cache Policy ID
const CLOUDFRONT_HOSTED_ZONE_ID = process.env.CLOUDFRONT_HOSTED_ZONE_ID;
const REMIX_CACHE_POLICY_ID = process.env.REMIX_CACHE_POLICY_ID;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const CLOUDFORMATION_ROLE_ARN = process.env.CLOUDFORMATION_ROLE_ARN;
const SAMEPAGE_HOSTED_ZONE_ID = process.env.SAMEPAGE_HOSTED_ZONE_ID;
const WEBSITE_PUBLISHING_LAMBDA_ARN = process.env.WEBSITE_PUBLISHING_LAMBDA_ARN;
const S3_WEBSITE_ENDPOINT = process.env.S3_WEBSITE_ENDPOINT;
const CLOUDFRONT_SECRET = process.env.CLOUDFRONT_SECRET;

const cf = new CloudFormation({});
const bodySchema = z.object({
  websiteUuid: z.string(),
  domain: z.string(),
  requestId: z.string(),
  userId: z.string(),
});

export const handler: Handler = async (data) => {
  const parsed = bodySchema.safeParse(data);
  if (!parsed.success) {
    const parsedError = new Error(parseZodError(parsed.error));
    parsedError.name = "ZodError";
    await emailError("Launch Failed", parsedError);
    return { success: false };
  }
  const { websiteUuid, domain, requestId, userId } = parsed.data;
  const logStatus = (status: string, props?: Record<string, Json>) =>
    logWebsiteStatus({
      websiteUuid,
      status,
      requestId,
      statusType: "LAUNCH",
      props,
    });
  try {
    if (!SAMEPAGE_HOSTED_ZONE_ID) {
      throw new Error("SAMEPAGE_HOSTED_ZONE_ID is not configured");
    }

    if (!SNS_TOPIC_ARN) {
      throw new Error("SNS_TOPIC_ARN is not configured");
    }

    if (!CLOUDFORMATION_ROLE_ARN) {
      throw new Error("CLOUDFORMATION_ROLE_ARN is not configured");
    }

    if (!WEBSITE_PUBLISHING_LAMBDA_ARN) {
      throw new Error("WEBSITE_PUBLISHING_LAMBDA_ARN is not configured");
    }

    if (!S3_WEBSITE_ENDPOINT) {
      throw new Error("S3_WEBSITE_ENDPOINT is not configured");
    }

    if (!CLOUDFRONT_SECRET) {
      throw new Error("CLOUDFRONT_SECRET is not configured");
    }

    await logStatus("CREATING WEBSITE");
    const isCustomDomain = !isSystemDomain(domain);

    const Tags = [
      {
        Key: "Application",
        Value: "SamePage Publishing",
      },
    ];
    const AliasTarget = {
      HostedZoneId: CLOUDFRONT_HOSTED_ZONE_ID,
      DNSName: {
        "Fn::GetAtt": ["CloudfrontDistribution", "DomainName"],
      },
    };
    const DomainName = { Ref: "DomainName" };
    const email = await users
      .getUser(userId)
      .then(
        (u) =>
          u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
            ?.emailAddress
      );

    if (!email) {
      throw new Error(`Could not find email for user: ${email}`);
    }

    const stackInput: CreateStackCommandInput = {
      NotificationARNs: [SNS_TOPIC_ARN],
      Parameters: [
        {
          ParameterKey: "Email",
          ParameterValue: email,
        },
        {
          ParameterKey: "CustomDomain",
          ParameterValue: `${isCustomDomain}`,
        },
        {
          ParameterKey: "DomainName",
          ParameterValue: domain,
        },
        {
          ParameterKey: "WebsiteUuid",
          ParameterValue: websiteUuid,
        },
        {
          ParameterKey: "Environment",
          ParameterValue: process.env.NODE_ENV,
        },
      ],
      RoleARN: CLOUDFORMATION_ROLE_ARN,
      StackName: getCloudformationStackName(websiteUuid),
      Tags,
      TemplateBody: JSON.stringify({
        Parameters: {
          Email: {
            Type: "String",
          },
          CustomDomain: {
            Type: "String",
          },
          DomainName: {
            Type: "String",
          },
          WebsiteUuid: {
            Type: "String",
          },
          Environment: {
            Type: "String",
          },
        },
        Conditions: {
          HasCustomDomain: {
            "Fn::Equals": [
              {
                Ref: "CustomDomain",
              },
              "true",
            ],
          },
          HasSystemDomain: {
            "Fn::Equals": [
              {
                Ref: "CustomDomain",
              },
              "false",
            ],
          },
        },
        Resources: {
          HostedZone: {
            Type: "AWS::Route53::HostedZone",
            Condition: "HasCustomDomain",
            Properties: {
              HostedZoneConfig: {
                Comment: `SamePage Publishing Website For ${websiteUuid}`,
              },
              Name: DomainName,
            },
          },
          AcmCertificate: {
            Type: "AWS::CertificateManager::Certificate",
            Condition: "HasCustomDomain",
            Properties: {
              DomainName,
              SubjectAlternativeNames: [],
              Tags,
              ValidationMethod: "DNS",
              DomainValidationOptions: [
                {
                  DomainName,
                  HostedZoneId: { "Fn::GetAtt": ["HostedZone", "Id"] },
                },
              ],
            },
          },
          AcmCertificateSystem: {
            Type: "AWS::CertificateManager::Certificate",
            Condition: "HasSystemDomain",
            Properties: {
              DomainName,
              SubjectAlternativeNames: [],
              Tags,
              ValidationMethod: "DNS",
              DomainValidationOptions: [
                {
                  DomainName,
                  HostedZoneId: SAMEPAGE_HOSTED_ZONE_ID,
                },
              ],
            },
          },
          CloudfrontDistribution: {
            Type: "AWS::CloudFront::Distribution",
            Condition: "HasCustomDomain",
            Properties: {
              DistributionConfig: {
                Aliases: [DomainName],
                Comment: `CloudFront CDN for ${websiteUuid}`,
                CustomErrorResponses: [
                  {
                    ErrorCode: 404,
                    ResponseCode: 200,
                    ResponsePagePath: "/404.html",
                  },
                  {
                    ErrorCode: 403,
                    ResponseCode: 200,
                    ResponsePagePath: "/index.html",
                  },
                ],
                DefaultCacheBehavior: {
                  AllowedMethods: ["GET", "HEAD", "OPTIONS"],
                  CachedMethods: ["GET", "HEAD", "OPTIONS"],
                  CachePolicyId: REMIX_CACHE_POLICY_ID,
                  Compress: true,
                  ForwardedValues: {
                    Cookies: {
                      Forward: "none",
                    },
                    QueryString: false,
                  },
                  LambdaFunctionAssociations: [
                    {
                      EventType: "origin-request",
                      IncludeBody: false,
                      LambdaFunctionARN: WEBSITE_PUBLISHING_LAMBDA_ARN,
                    },
                  ],
                  TargetOriginId: `S3-${domain}`,
                  ViewerProtocolPolicy: "redirect-to-https",
                },
                DefaultRootObject: `websites/${websiteUuid}/index.html`,
                Enabled: true,
                IPV6Enabled: true,
                Origins: [
                  {
                    CustomOriginConfig: {
                      HTTPPort: 80,
                      HTTPSPort: 443,
                      OriginProtocolPolicy: "http-only",
                      OriginSSLProtocols: ["TLSv1", "TLSv1.2"],
                    },
                    DomainName: S3_WEBSITE_ENDPOINT,
                    Id: `S3-${domain}`,
                    OriginCustomHeaders: [
                      {
                        HeaderName: "User-Agent",
                        HeaderValue: CLOUDFRONT_SECRET,
                      },
                      {
                        HeaderName: "X-Samepage-Website-Uuid",
                        HeaderValue: websiteUuid,
                      },
                    ],
                  },
                ],
                PriceClass: "PriceClass_All",
                ViewerCertificate: {
                  AcmCertificateArn: {
                    Ref: "AcmCertificate",
                  },
                  MinimumProtocolVersion: "TLSv1_2016",
                  SslSupportMethod: "sni-only",
                },
              },
              Tags,
            },
          },
          CloudfrontDistributionSystem: {
            Type: "AWS::CloudFront::Distribution",
            Condition: "HasSystemDomain",
            Properties: {
              DistributionConfig: {
                Aliases: [DomainName],
                Comment: `CloudFront CDN for ${domain}`,
                CustomErrorResponses: [
                  {
                    ErrorCode: 404,
                    ResponseCode: 200,
                    ResponsePagePath: "/404.html",
                  },
                  {
                    ErrorCode: 403,
                    ResponseCode: 200,
                    ResponsePagePath: "/index.html",
                  },
                ],
                DefaultCacheBehavior: {
                  AllowedMethods: ["GET", "HEAD", "OPTIONS"],
                  CachedMethods: ["GET", "HEAD", "OPTIONS"],
                  CachePolicyId: REMIX_CACHE_POLICY_ID,
                  Compress: true,
                  ForwardedValues: {
                    Cookies: {
                      Forward: "none",
                    },
                    QueryString: false,
                  },
                  LambdaFunctionAssociations: [
                    {
                      EventType: "origin-request",
                      IncludeBody: false,
                      LambdaFunctionARN: WEBSITE_PUBLISHING_LAMBDA_ARN,
                    },
                  ],
                  TargetOriginId: `S3-${domain}`,
                  ViewerProtocolPolicy: "redirect-to-https",
                },
                DefaultRootObject: `websites/${websiteUuid}/index.html`,
                Enabled: true,
                IPV6Enabled: true,
                Origins: [
                  {
                    CustomOriginConfig: {
                      HTTPPort: 80,
                      HTTPSPort: 443,
                      OriginProtocolPolicy: "http-only",
                      OriginSSLProtocols: ["TLSv1", "TLSv1.2"],
                    },
                    DomainName: S3_WEBSITE_ENDPOINT,
                    Id: `S3-${domain}`,
                    OriginCustomHeaders: [
                      {
                        HeaderName: "User-Agent",
                        HeaderValue: CLOUDFRONT_SECRET,
                      },
                      {
                        HeaderName: "X-Samepage-Website-Uuid",
                        HeaderValue: websiteUuid,
                      },
                    ],
                  },
                ],
                PriceClass: "PriceClass_All",
                ViewerCertificate: {
                  AcmCertificateArn: {
                    Ref: "AcmCertificateSystem",
                  },
                  MinimumProtocolVersion: "TLSv1_2016",
                  SslSupportMethod: "sni-only",
                },
              },
              Tags,
            },
          },
          Route53ARecord: {
            Type: "AWS::Route53::RecordSet",
            Condition: "HasCustomDomain",
            Properties: {
              AliasTarget,
              HostedZoneId: { "Fn::GetAtt": ["HostedZone", "Id"] },
              Name: DomainName,
              Type: "A",
            },
          },
          Route53AAAARecord: {
            Type: "AWS::Route53::RecordSet",
            Condition: "HasCustomDomain",
            Properties: {
              AliasTarget,
              HostedZoneId: { "Fn::GetAtt": ["HostedZone", "Id"] },
              Name: DomainName,
              Type: "AAAA",
            },
          },
          Route53ARecordSystem: {
            Type: "AWS::Route53::RecordSet",
            Condition: "HasSystemDomain",
            Properties: {
              AliasTarget: {
                HostedZoneId: CLOUDFRONT_HOSTED_ZONE_ID,
                DNSName: {
                  "Fn::GetAtt": ["CloudfrontDistributionSystem", "DomainName"],
                },
              },
              HostedZoneId: SAMEPAGE_HOSTED_ZONE_ID,
              Name: DomainName,
              Type: "A",
            },
          },
          Route53AAAARecordSystem: {
            Type: "AWS::Route53::RecordSet",
            Condition: "HasSystemDomain",
            Properties: {
              AliasTarget: {
                HostedZoneId: CLOUDFRONT_HOSTED_ZONE_ID,
                DNSName: {
                  "Fn::GetAtt": ["CloudfrontDistributionSystem", "DomainName"],
                },
              },
              HostedZoneId: SAMEPAGE_HOSTED_ZONE_ID,
              Name: DomainName,
              Type: "AAAA",
            },
          },
        },
      }),
    };
    await uploadFileContent({
      Key: `data/website-stacks/${websiteUuid}.json`,
      Body: JSON.stringify(stackInput, null, 4),
    });
    await cf.createStack(stackInput);

    const cxn = await getMysql(requestId);
    await cxn
      .update(websites)
      .set({ live: true })
      .where(eq(websites.uuid, websiteUuid));
    await cxn.end();

    return { success: true };
  } catch (err) {
    const e = err as Error;
    await logStatus("FAILURE", { message: e.message });
    await emailError("Launch Failed", e);
    return { success: false };
  }
};
