import { S3 } from "@aws-sdk/client-s3";
import { domain } from "@dvargas92495/app/backend/constants.server";
import APPS from "package/src/internal/apps";

const s3 = new S3({ region: "us-east-1" });

const listExtensionsMetadata = async () => {
  return Promise.all(
    APPS.slice(1).map((app) =>
      s3
        .listObjectsV2({
          Bucket: domain,
          Prefix: `extensions/${app.name.toLowerCase()}/`,
          // StartAfter: "",
        })
        .then((extensions) => {
          return {
            versions: (extensions.Contents || []).map((c) => {
              const [_, version] = (c.Key || "")
                .replace(/^extensions\//, "")
                .replace(/\.zip$/, "")
                .split("/");
              return version;
            }),
            id: app.id,
          };
        })
    )
  ).then((extensions) => ({
    versions: Object.fromEntries(extensions.map((e) => [e.id, e.versions])),
  }));
};

export default listExtensionsMetadata;
