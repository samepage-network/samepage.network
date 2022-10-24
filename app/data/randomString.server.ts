import { randomBytes } from "crypto";

const randomString = ({
  length,
  encoding,
}: {
  encoding: BufferEncoding;
  length: number;
}) =>
  new Promise<string>((resolve) =>
    randomBytes(length, function (_, buffer) {
      resolve(buffer.toString(encoding));
    })
  );

export default randomString;
