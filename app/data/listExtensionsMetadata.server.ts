import { S3 } from "@aws-sdk/client-s3";
import { domain } from "@dvargas92495/app/backend/constants.server";
import APPS from "package/internal/apps";

const s3 = new S3({ region: "us-east-1" });
const SEMVER =
  /^([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?$/;

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
            versions: (extensions.Contents || [])
              .map((c) => {
                const [_, version] = (c.Key || "")
                  .replace(/^extensions\//, "")
                  .replace(/\.zip$/, "")
                  .split("/");
                return version;
              })
              .sort((a, b) => {
                if (SEMVER.test(b) && SEMVER.test(a)) return b.localeCompare(a);
                else if (SEMVER.test(a)) return -1;
                else if (SEMVER.test(b)) return 1;
                else return b.localeCompare(a);
              })
              .slice(0, 5),
            id: app.id,
          };
        })
    )
  ).then((extensions) => ({
    versions: Object.fromEntries(extensions.map((e) => [e.id, e.versions])),
  }));
};

export default listExtensionsMetadata;
