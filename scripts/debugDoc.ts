import base64ToBinary from "../package/internal/base64ToBinary";
import Automerge from "automerge";
import randomString from "../app/data/randomString.server";
import fs from "fs";
import { LatestSchema } from "../package/internal/types";
import unwrapSchema from "../package/utils/unwrapSchema";

const run = async () => {
  const input = process.argv[2];
  console.log("reading", input);
  const base64 = fs.readFileSync(input).toString();
  const doc = Automerge.load<LatestSchema>(
    base64ToBinary(base64) as Automerge.BinaryDocument
  );
  const filename = `/tmp/${await randomString({
    length: 8,
    encoding: "hex",
  })}.json`;
  doc.annotations.map(({ startIndex, endIndex, ...a }, i) => {
    if (endIndex.value < startIndex.value) {
      console.log("annotation", a.type, "from index", i);
      console.log("starting", startIndex.value, "ending", endIndex.value);
    }
  });
  const unwrapped = unwrapSchema(doc);
  fs.writeFileSync(filename, JSON.stringify({ doc, unwrapped }, null, 2));
  console.log("Doc found in:", filename);
};

run();
