import { S3, GetObjectCommandInput } from "@aws-sdk/client-s3";
import fs from "fs";
import { Readable } from "stream";

const getDefault = () => {
  const r = new Readable();
  r.push(null);
  return r;
};

const downloadFile = ({
  Key = "",
}: Partial<Pick<GetObjectCommandInput, "Key">>) => {
  if (process.env.NODE_ENV === "production") {
    const s3 = new S3({
      region: "us-east-1",
      // TODO
      // endpoint: process.env.AWS_ENDPOINT,
    });
    const Bucket = "samepage.network";
    return s3.listObjectsV2({ Bucket, Prefix: Key }).then((r) => {
      if (r.KeyCount === 0) return getDefault();
      return s3
        .getObject({
          Bucket,
          Key,
        })
        .then((r) => r.Body as Readable);
    });
  } else {
    const path = `public/${Key}`;
    if (!fs.existsSync(path)) return Promise.resolve(getDefault());
    return Promise.resolve(fs.createReadStream(path));
  }
};

export const downloadFileBuffer = (
  args: Parameters<typeof downloadFile>[0]
): Promise<Buffer> =>
  downloadFile(args).then((fil) => {
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      fil.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      fil.on("error", (err) => reject(err));
      fil.on("end", () => resolve(Buffer.concat(chunks)));
    });
  });

export const downloadFileContent = (
  args: Parameters<typeof downloadFile>[0]
): Promise<string> =>
  downloadFileBuffer(args).then((fil) => fil.toString("utf8"));

export default downloadFile;
