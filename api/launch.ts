import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { users } from "@clerk/clerk-sdk-node";
import { Handler } from "aws-lambda";
import emailError from "package/backend/emailError.server";
import { Json } from "package/internal/types";
import logWebsiteStatus from "~/data/logWebsiteStatus.server";

// Remix Cache Policy ID
const CLOUDFRONT_HOSTED_ZONE_ID = "Z2FDTNDATAQYW2";
const REMIX_CACHE_POLICY_ID = process.env.REMIX_CACHE_POLICY_ID;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const CLOUDFORMATION_ROLE_ARN = process.env.CLOUDFORMATION_ROLE_ARN;
const SAMEPAGE_HOSTED_ZONE_ID = process.env.SAMEPAGE_HOSTED_ZONE_ID;
const WEBSITE_PUBLISHING_LAMBDA_ARN = process.env.WEBSITE_PUBLISHING_LAMBDA_ARN;
const S3_WEBSITE_ENDPOINT = process.env.S3_WEBSITE_ENDPOINT;
const CLOUDFRONT_SECRET = process.env.CLOUDFRONT_SECRET;

const cf = new CloudFormation({});

export const handler: Handler<{
  websiteUuid: string;
  domain: string;
  requestId: string;
  userId: string;
}> = async ({ websiteUuid, domain, requestId, userId }) => {
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

    await logStatus("ALLOCATING HOST");
    const isCustomDomain = !domain.endsWith(".roamjs.com");

    await logStatus("CREATING WEBSITE");
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

    await cf.createStack({
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
      ],
      RoleARN: CLOUDFORMATION_ROLE_ARN,
      StackName: `samepage-publishing-${websiteUuid}`,
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
          RoamGraph: {
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
          HasRoamjsDomain: {
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
          AcmCertificateRoamjs: {
            Type: "AWS::CertificateManager::Certificate",
            Condition: "HasRoamjsDomain",
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
                DefaultRootObject: `${websiteUuid}/index.html`,
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
          CloudfrontDistributionRoamjs: {
            Type: "AWS::CloudFront::Distribution",
            Condition: "HasRoamjsDomain",
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
                DefaultRootObject: `${websiteUuid}/index.html`,
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
                    Ref: "AcmCertificateRoamjs",
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
          Route53ARecordRoamjs: {
            Type: "AWS::Route53::RecordSet",
            Condition: "HasRoamjsDomain",
            Properties: {
              AliasTarget: {
                HostedZoneId: CLOUDFRONT_HOSTED_ZONE_ID,
                DNSName: {
                  "Fn::GetAtt": ["CloudfrontDistributionRoamjs", "DomainName"],
                },
              },
              HostedZoneId: SAMEPAGE_HOSTED_ZONE_ID,
              Name: DomainName,
              Type: "A",
            },
          },
          Route53AAAARecordRoamjs: {
            Type: "AWS::Route53::RecordSet",
            Condition: "HasRoamjsDomain",
            Properties: {
              AliasTarget: {
                HostedZoneId: CLOUDFRONT_HOSTED_ZONE_ID,
                DNSName: {
                  "Fn::GetAtt": ["CloudfrontDistributionRoamjs", "DomainName"],
                },
              },
              HostedZoneId: SAMEPAGE_HOSTED_ZONE_ID,
              Name: DomainName,
              Type: "AAAA",
            },
          },
        },
      }),
    });

    return { success: true };
  } catch (err) {
    const e = err as Error;
    await logStatus("FAILURE", { message: e.message });
    await emailError("Launch Failed", e);
    return { success: false };
  }
};
