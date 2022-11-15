import getRemixHandler from "@dvargas92495/app/backend/getRemixHandler.server";
export const handler = getRemixHandler({
  originPaths: [
    {
      test: /^\/extensions\/[a-z0-9]+\.zip$/,
      mapper: (s: string) =>
        import("@aws-sdk/client-s3")
          .then((r) => {
            const s3 = new r.S3({ region: "us-east-1" });
            return s3.listObjectsV2({
              Bucket: "samepage.network",
              Prefix: s.replace(/\.zip$/, "/"),
              StartAfter: s.replace(/\.zip$/, "/2022-09-21-00-00.zip"),
            });
          })
          .then((r) => {
            if (!r.Contents) return s;
            return r.Contents.slice(-1)[0].Key || s;
          }),
    },
    /^\/extensions\/[a-z0-9]+\/[\d-]+\.zip$/,
    /^\/extensions\/tests\/.+$/,
  ],
});
