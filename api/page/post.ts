import createAPIGatewayProxyHandler from "aws-sdk-plus/dist/createAPIGatewayProxyHandler";
import { ClientId } from "~/enums/clients";
import { ConflictError, NotFoundError } from "aws-sdk-plus/dist/errors";
import catchError from "~/data/catchError.server";
import getMysql from "@dvargas92495/app/backend/mysql.server";
import { downloadFileContent } from "@dvargas92495/app/backend/downloadFile.server";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import { S3 } from "@aws-sdk/client-s3";
import { v4 } from "uuid";

const s3 = new S3({ region: "us-east-1" });

// @todo - replace with @json
type ViewType = "document" | "bullet" | "numbered";
type TextAlignment = "left" | "center" | "right";
type ActionParams = {
  location?: {
    "parent-uid": string;
    order: number;
  };
  block?: {
    string?: string;
    uid?: string;
    open?: boolean;
    heading?: number;
    "text-align"?: TextAlignment;
    "children-view-type"?: ViewType;
  };
  page?: {
    title?: string;
    uid?: string;
  };
};

type Action = {
  action: "createBlock" | "updateBlock" | "deleteBlock";
  params: ActionParams;
};

const getSharedPage = ({
  instance,
  clientPageId,
  client,
}: {
  instance: string;
  clientPageId: string;
  client: ClientId;
}) =>
  getMysql().then((cxn) =>
    cxn
      .execute(
        `SELECT page_uuid FROM page_instance_links WHERE instance = ? AND client = ? AND client_page_id = ?`,
        [instance, client, clientPageId]
      )
      .then((results) => {
        cxn.destroy();
        const [link] = results as { page_uuid: string }[];
        if (!link)
          throw new NotFoundError(
            `Could not find page from client ${client}, instance ${instance}, and clientPageId ${clientPageId}`
          );
        return link.page_uuid;
      })
  );

const messageInstance = ({
  source,
  target,
  data,
  messageUuid = v4(),
}: {
  source: { instance: string; client: ClientId };
  target: { instance: string; client: ClientId };
  messageUuid?: string;
  data: Record<string, unknown>;
}) => {
  console.log("TODO:", source, target, data, messageUuid);
};

const logic = ({
  method,
  client,
  instance,
  pageUuid,
  clientPageId,
  log,
}: {
  method: string;
  client: ClientId;
  instance: string;
  pageUuid: string;
  clientPageId: string;
  log: Action[];
}) => {
  switch (method) {
    case "join-shared-page": {
      return downloadFileContent({
        Key: `data/page/${pageUuid}.json`,
      })
        .catch((e) =>
          e.name === "NoSuchKey"
            ? Promise.reject(
                new ConflictError(
                  `No shared page exists under uuid ${pageUuid}`
                )
              )
            : Promise.reject(e)
        )
        .then((r) => {
          return getMysql().then((cxn) => {
            const args = [pageUuid, clientPageId, instance, client];
            return (
              cxn
                .execute(
                  `INSERT INTO page_instance_links (uuid, page_uuid, client_page_id, instance, client)
            VALUES (UUID(), ?, ?, ?, ?)`,
                  args
                )
                // TODO: return body string directly, it's already stringified JSON
                .then(() => r)
                .catch((e) =>
                  Promise.reject(
                    new Error(
                      `Failed to insert link: ${JSON.stringify(
                        args,
                        null,
                        4
                      )}\nReason: ${e.message}`
                    )
                  )
                )
                .finally(() => cxn.destroy())
            );
          });
        })
        .catch(catchError("Failed to join a shared page"));
    }
    case "update-shared-page": {
      if (!log.length) {
        return getSharedPage({ instance, clientPageId, client })
          .then((id) =>
            s3
              .headObject({
                Bucket: "roamjs-data",
                Key: `data/page/${id}.json`,
              })
              .then((r) => ({
                newIndex: Number(r.Metadata?.index) || 0,
              }))
          )
          .catch(catchError("Failed to update a shared page with empty log"));
      }
      return getSharedPage({ instance, clientPageId, client })
        .then((id) => {
          return downloadFileContent({
            Key: `data/page/${id}.json`,
          })
            .then((r) => JSON.parse(r))
            .then((data) => {
              const updatedLog = data.log.concat(log) as Action[];
              const state = data.state;
              log.forEach(({ action, params }) => {
                if (
                  action === "createBlock" &&
                  params.block &&
                  params.location
                ) {
                  const { uid = "", ...block } = params.block;
                  state[params.location["parent-uid"]] = {
                    ...state[params.location["parent-uid"]],
                    children: (
                      state[params.location["parent-uid"]]?.children || []
                    )?.splice(params.location.order, 0, uid),
                  };
                  state[uid] = block;
                } else if (action === "updateBlock" && params.block) {
                  const { uid = "", ...block } = params.block;
                  state[uid] = {
                    ...block,
                    children: state[uid]?.children || [],
                  };
                } else if (action === "deleteBlock" && params.block) {
                  delete state[params.block.uid || ""];
                }
              });
              return uploadFile({
                Key: `data/page/${id}.json`,
                Body: JSON.stringify({ log: updatedLog, state }),
                // Metadata: { index: updatedLog.length.toString() }, TODO
              }).then(() => updatedLog.length);
            })
            .then((newIndex) => {
              return getMysql()
                .then((cxn) =>
                  cxn
                    .execute(
                      `SELECT instance, client FROM page_instance_links WHERE page_uuid = ?`,
                      [id]
                    )
                    .then((r) => {
                      cxn.destroy();
                      return Promise.all(
                        (r as { client: ClientId; instance: string }[])
                          .filter((item) => {
                            return (
                              item.instance !== instance ||
                              item.client !== client
                            );
                          })
                          .map((target) =>
                            messageInstance({
                              source: { client, instance },
                              target,
                              data: {
                                log,
                                clientPageId,
                                index: newIndex,
                                operation: "SHARE_PAGE_UPDATE",
                              },
                            })
                          )
                      );
                    })
                )
                .then(() => ({
                  newIndex,
                }));
            });
        })
        .catch(catchError("Failed to update a shared page"));
    }
    default:
      throw new NotFoundError(`Unknown method: ${method}`);
  }
};

export const handler = createAPIGatewayProxyHandler(logic);
