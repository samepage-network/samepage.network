import { S3 } from "@aws-sdk/client-s3";
import { domain } from "@dvargas92495/app/backend/constants.server";

const s3 = new S3({ region: "us-east-1" });

const listExtensionsMetadata = async () => {
  return s3
    .listObjectsV2({ Bucket: domain, Prefix: "extensions" })
    .then((extensions) =>
      Promise.all(
        (extensions.Contents || []).map((c) =>
          s3.headObject({ Bucket: domain, Key: c.Key }).then((k) => ({
            version: k.Metadata?.version || "UNAVAILABLE",
            id: (c.Key || "")
              .replace(/^extensions\//, "")
              .replace(/\.zip$/, ""),
          }))
        )
      )
    )
    .then((extensions) => ({
      versions: Object.fromEntries(extensions.map((e) => [e.id, e.version])),
    }));
};

export default listExtensionsMetadata;
