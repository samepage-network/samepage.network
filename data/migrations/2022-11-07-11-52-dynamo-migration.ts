import AWS from "aws-sdk";
import type { MigrationProps } from "fuegojs/types";
import { Notebook } from "package/internal/types";
import { v4 } from "uuid";
import fs from "fs";
import crypto from "crypto";

const dynamo = new AWS.DynamoDB();
const s3 = new AWS.S3();
const BATCH_MAX = 25;

const getOrGenerateNotebookUuid = async ({
  cxn,
  workspace,
  app,
}: { cxn: MigrationProps["connection"] } & Notebook) => {
  const [existingNotebooks] = await cxn.execute(
    `SELECT n.uuid FROM notebooks n
      where n.workspace = ? and n.app = ?`,
    [workspace, app]
  );
  const [potentialNotebookUuid] = existingNotebooks as { uuid: string }[];
  return (
    potentialNotebookUuid?.uuid ||
    Promise.resolve(v4()).then((uuid) =>
      cxn
        .execute(
          `INSERT INTO notebooks (uuid, app, workspace)
      VALUES (?, ?, ?)`,
          [uuid, app, workspace]
        )
        .then(() => uuid)
    )
  );
};

export const migrate = (args: MigrationProps) => {
  return dynamo
    .scan({ TableName: "RoamJSMultiplayer" })
    .promise()
    .then((r) => {
      if (!r.Items) return Promise.resolve();
      console.log("Found", r.Count, "items to migrate");
      return Promise.all(
        r.Items.map(
          async (item): Promise<AWS.DynamoDB.AttributeMap | undefined> => {
            try {
              if (
                /\$synced$/.test(item.entity.S || "") ||
                /\$message$/.test(item.entity.S || "")
              ) {
                const targetWorkspace = item.entity.S?.replace(
                  /-\$synced$/,
                  ""
                );
                const target = await getOrGenerateNotebookUuid({
                  app: 1,
                  workspace: targetWorkspace || "",
                  cxn: args.connection,
                });
                const source = await getOrGenerateNotebookUuid({
                  app: 1,
                  workspace: item.graph.S || "",
                  cxn: args.connection,
                });
                const raw = await s3
                  .getObject({
                    Bucket: "roamjs-data",
                    Key: `multiplayer/messages/${item.id.S}.json`,
                  })
                  .promise()
                  // @ts-ignore
                  .then((r) => r.Body?.toString() || "{}")
                  .catch(() => {
                    return JSON.stringify({ operation: "NOT_FOUND" });
                  });
                const rawOp = JSON.parse(raw).operation;

                const operation = !rawOp
                  ? ""
                  : rawOp === "QUERY_REF" || rawOp === "QUERY"
                  ? "QUERY"
                  : rawOp === "COPY_BLOCK"
                  ? "COPY_BLOCK"
                  : rawOp === "SHARE_PAGE_UPDATE"
                  ? "SHARE_PAGE_UPDATE"
                  : rawOp === "SEND_PAGE"
                  ? "SEND_PAGE"
                  : rawOp === "NOT_FOUND"
                  ? "NOT_FOUND"
                  : rawOp.startsWith("QUERY_REF_RESPONSE")
                  ? "QUERY_RESPONSE"
                  : rawOp.startsWith("SEND_PAGE_RESPONSE")
                  ? "SEND_PAGE_RESPONSE"
                  : rawOp.startsWith("COPY_BLOCK_RESPONSE")
                  ? "COPY_BLOCK_RESPONSE"
                  : "";
                if (operation) {
                  await s3
                    .putObject({
                      Bucket: "samepage.network",
                      Key: `data/messages/${item.id.S}.json`,
                      Body: raw,
                    })
                    .promise();
                  await s3
                    .deleteObject({
                      Bucket: "roamjs-data",
                      Key: `multiplayer/messages/${item.id.S}.json`,
                    })
                    .promise()
                    .catch(() => "");
                  await args.connection.execute(
                    `INSERT INTO messages (uuid, created_date, marked, source, target, operation, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE operation=operation`,
                    [
                      item.id.S,
                      new Date(),
                      /\$synced$/.test(item.entity.S || ""),
                      source,
                      target,
                      operation,
                      null,
                    ]
                  );
                  return item;
                }
                console.log("unknown operation", raw);
              } else if (
                /^\$session$/.test(item.entity.S || "") ||
                /^\$client$/.test(item.entity.S || "")
              ) {
                const source = await getOrGenerateNotebookUuid({
                  app: 1,
                  workspace: item.graph?.S || "UNKNOWN",
                  cxn: args.connection,
                });
                await args.connection.execute(
                  `INSERT INTO client_sessions (id, created_date, end_date, disconnected_by, notebook_uuid)
                  VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE end_date=end_date`,
                  [
                    item.id?.S || v4(),
                    new Date(item.initiated?.S || new Date()),
                    new Date(item.date?.S || new Date()),
                    item.disconnectedBy?.S || "Unknown",
                    source,
                  ]
                );
                return item;
              } else if (/^\$network$/.test(item.entity.S || "")) {
                await getOrGenerateNotebookUuid({
                  app: 1,
                  workspace: item.graph.S || "",
                  cxn: args.connection,
                });
                return item;
              } else if (/-dev$/.test(item.entity.S || "")) {
                // just delete
                return item;
              } else if (/^\$shared/.test(item.entity.S || "")) {
                const source = await getOrGenerateNotebookUuid({
                  app: 1,
                  workspace: item.graph.S || "",
                  cxn: args.connection,
                });
                const [_, __, notebookPageId] = item.entity.S!.split(":");
                const pageUuid = item.id.S;
                await args.connection.execute(
                  `INSERT INTO pages (uuid, version)
                  VALUES (?, 0)
                  ON DUPLICATE KEY UPDATE version = version`,
                  [pageUuid]
                );
                await args.connection.execute(
                  `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, version, open, invited_by, invited_date, notebook_uuid, cid)
                  VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE version = version`,
                  [
                    v4(),
                    pageUuid,
                    notebookPageId,
                    0,
                    source,
                    new Date(item.date.S || new Date()),
                    source,
                    "",
                  ]
                );
                const sharedPage = await s3
                  .getObject({
                    Bucket: "roamjs-data",
                    Key: `multiplayer/shared/${item.id.S}.json`,
                  })
                  .promise();
                await s3
                  .putObject({
                    Bucket: "samepage.network",
                    Key: `data/shared/${item.id.S}.json`,
                    Body: sharedPage.Body,
                  })
                  .promise();
                await s3
                  .deleteObject({
                    Bucket: "roamjs-data",
                    Key: `multiplayer/shared/${item.id.S}.json`,
                  })
                  .promise()
                  .catch(() => "");
                return item;
              } else if (/^\$reference/.test(item.entity.S || "")) {
                await getOrGenerateNotebookUuid({
                  app: 1,
                  workspace: item.graph.S || "",
                  cxn: args.connection,
                });
                const hash = crypto
                  .createHash("md5")
                  .update(item.id.S || "")
                  .digest("hex");
                const Body = await s3
                  .getObject({
                    Bucket: "roamjs-data",
                    Key: `multiplayer/queries/${hash}.json`,
                  })
                  .promise()
                  .then((r) => r.Body)
                  .catch(() => "{}");
                await s3
                  .putObject({
                    Bucket: "samepage.network",
                    Key: `data/queries/${hash}.json`,
                    Body,
                  })
                  .promise();
                // await s3
                //   .deleteObject({
                //     Bucket: "roamjs-data",
                //     Key: `multiplayer/queries/${hash}.json`,
                //   })
                //   .promise().catch(() => "");
                return item;
              } else if (/^\$ongoing/.test(item.entity.S || "")) {
                // just delete
                await Promise.all(
                  (item.entity.NS || []).map((id) =>
                    s3
                      .deleteObject({
                        Bucket: "roamjs-data",
                        Key: `multiplayer/ongoing/${item.id.S}/chunk${id}`,
                      })
                      .promise()
                  )
                );
                return item;
              } else if (item.id.S === item.graph?.S) {
                // just delete
                return item;
              }
              console.log("missed", item);
              return Promise.resolve(undefined);
            } catch (e) {
              console.log("failed", item, e);
              return Promise.resolve(undefined);
            }
          }
        )
      )
        .then((items) => {
          const migrated = items.filter((i) => !!i);
          const reqs = Math.ceil(migrated.length / BATCH_MAX);
          // this failed with schema validation error
          const batches = migrated.length
            ? Array(reqs)
                .fill(null)
                .map((_, index) => ({
                  RequestItems: {
                    RoamJSMultiplayer: migrated
                      .slice(index * BATCH_MAX, (index + 1) * BATCH_MAX)
                      .map((m) => ({
                        DeleteRequest: {
                          Key: { id: { S: m?.id.S || "" } },
                        },
                      })),
                  },
                }))
            : [];
          console.log(
            "migrated",
            migrated.length,
            "records, now deleting",
            batches.length,
            "batches of records"
          );
          fs.mkdirSync("public/data/migration/dynamo", { recursive: true });
          return Promise.all(
            batches.map(
              (batch) => dynamo.batchWriteItem(batch).promise()
              // local testing
              //   fs.writeFileSync(
              //     `public/data/migration/dynamo/${i}`,
              //     JSON.stringify(batch)
              //   )
            )
          );
        })
        .then(() => console.log("Done!"));
    });
};

export const revert = () => {
  return Promise.resolve();
};
