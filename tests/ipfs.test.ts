import { test, expect } from "@playwright/test";
import Automerge from "automerge";
import { encode, decode } from "@ipld/dag-cbor";
import { Web3Storage, File } from "web3.storage";
import { S3 } from "@aws-sdk/client-s3";
import { Readable } from "stream";

test("Demo showing basic use case of Web3 Storage", async () => {
  test.setTimeout(60000);

  const inputData = Automerge.from({ foo: "bar" });
  const body = Automerge.save(inputData); // creates a Uint8Array
  const memo = {
    parent: null,
    headers: {},
    body,
  }; // copying some noosphere conventions for ease of future migration

  const client = new Web3Storage({
    token: process.env.WEB3_STORAGE_API_KEY || "",
  });
  const encodedData = encode(memo);
  const ipfsUploadStart = performance.now();
  const cid = await client.put([new File([encodedData], "blob")], {
    wrapWithDirectory: false,
  });
  console.log(
    "Time to upload data to IPFS:",
    performance.now() - ipfsUploadStart
  ); // 1s - 2s

  const fetch = async () => {
    const ipfsDownloadStart = performance.now();
    const response = await client.get(cid);
    console.log(
      "Time to download data from IPFS:",
      performance.now() - ipfsDownloadStart
    );
    const files = await response!.files();
    const encodedDataFromIpfs = await files[0].arrayBuffer();
    const decodedDataFromIpfs = decode<typeof memo>(
      new Uint8Array(encodedDataFromIpfs)
    );
    const outputData = Automerge.load(decodedDataFromIpfs.body);
    expect(outputData).toEqual(inputData);
  };
  await fetch(); // anywhere between 2s - 25s
  await fetch(); // under 500ms
  await fetch(); // under 500ms

  // COMPARED TO S3 BELOW

  const s3Client = new S3({ region: "us-east-1" });
  const s3UploadStart = performance.now();
  await s3Client.putObject({
    Bucket: "samepage.network",
    Key: `data/ipfs/${cid}`,
    Body: encodedData,
  }); // under 500 ms
  console.log("Time to upload data to S3:", performance.now() - s3UploadStart); // 1s - 2s

  const fetchS3 = async () => {
    const s3DownloadStart = performance.now();
    const response = await s3Client.getObject({
      Bucket: "samepage.network",
      Key: `data/ipfs/${cid}`,
    });
    console.log(
      "Time to download data from S3:",
      performance.now() - s3DownloadStart
    );
    const chunks: Buffer[] = [];
    const encodedDataFromIpfs = await new Promise<Buffer>((resolve, reject) => {
      const fil = response.Body as Readable;
      fil.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      fil.on("error", (err) => reject(err));
      fil.on("end", () => resolve(Buffer.concat(chunks)));
    });
    const decodedDataFromIpfs = decode<typeof memo>(
      new Uint8Array(encodedDataFromIpfs)
    );
    const outputData = Automerge.load(decodedDataFromIpfs.body);
    expect(outputData).toEqual(inputData);
  };
  await fetchS3(); // under 100ms
  await fetchS3(); // under 100ms
  await fetchS3(); // under 100ms
});
