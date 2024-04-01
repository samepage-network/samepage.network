import { S3 } from "@aws-sdk/client-s3";

const listAllFiles = async ({
  Bucket,
  Prefix: rawPrefix,
}: {
  Bucket: string;
  Prefix: string;
}) => {
  const Prefix = rawPrefix.endsWith("/") ? rawPrefix : `${rawPrefix}/`;

  const s3 = new S3({});
  const fileSet = new Set<string>();
  const listObjectsRequest = {
    Bucket,
    Prefix,
    ContinuationToken: undefined as string | undefined,
  };
  let finished = false;
  while (!finished) {
    const { Contents, IsTruncated, NextContinuationToken } =
      await s3.listObjectsV2(listObjectsRequest);
    (Contents ?? [])
      .map(({ Key = "" }) => {
        return Key;
      })
      .forEach((k) => fileSet.add(k));
    finished = !IsTruncated;
    listObjectsRequest.ContinuationToken = NextContinuationToken;
  }

  return fileSet;
};

export default listAllFiles;
