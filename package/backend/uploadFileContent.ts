import { S3, PutObjectCommandInput } from "@aws-sdk/client-s3";
import fs from "fs";
import nodepath from "path";
import { Readable } from "stream";

const uploadFileContent = ({
  Key = "",
  Body = "",
}: Partial<Pick<PutObjectCommandInput, "Body" | "Key">>) => {
  if (process.env.NODE_ENV === "production") {
    const s3 = new S3({ region: "us-east-1" });
    return s3
      .putObject({
        Bucket: "samepage.network",
        Key,
        Body,
      })
      .then(() => true);
  } else {
    const path = `public/${Key}`;
    const dir = nodepath.dirname(path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (typeof Body === "string") fs.writeFileSync(path, Body);
    else if (Body instanceof Buffer || Body instanceof Uint8Array)
      fs.writeFileSync(path, Body);
    else if (Body instanceof Readable) Body.pipe(fs.createWriteStream(path));
    // else if (Body instanceof Blob)
    //   Body.stream().pipeTo(fs.createWriteStream(path));
    // else if (Body instanceof ReadableStream) Body.pipeTo(fs.createWriteStream(path));
    return Promise.resolve(true);
  }
};

export default uploadFileContent;
