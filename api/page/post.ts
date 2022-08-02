import createAPIGatewayProxyHandler from "aws-sdk-plus/dist/createAPIGatewayProxyHandler";
import { AppId } from "~/enums/apps";
import {
  ConflictError,
  NotFoundError,
} from "aws-sdk-plus/dist/errors";
import catchError from "~/data/catchError.server";
import getMysql from "@dvargas92495/app/backend/mysql.server";
import { downloadFileContent } from "@dvargas92495/app/backend/downloadFile.server";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import { S3 } from "@aws-sdk/client-s3";
import { v4 } from "uuid";
import postToConnection, {
  removeLocalSocket,
} from "~/data/postToConnection.server";
import endClient from "~/data/endClient.server";
import differenceInMinutes from "date-fns/differenceInMinutes";
import format from "date-fns/format";
import { Action } from "~/types";
import crypto from "crypto";

const s3 = new S3({ region: "us-east-1" });

const getSharedPage = ({
  instance,
  notebookPageId,
  app,
  safe,
}: {
  instance: string;
  notebookPageId: string;
  app: AppId;
  safe?: boolean;
}) =>
  getMysql().then((cxn) =>
    cxn
      .execute(
        `SELECT page_uuid FROM page_instance_links WHERE instance = ? AND app = ? AND notebook_page_id = ?`,
        [instance, app, notebookPageId]
      )
      .then((results) => {
        const [link] = results as { page_uuid: string }[];
        if (!link && !safe)
          throw new NotFoundError(
            `Could not find page from app ${app}, instance ${instance}, and notebookPageId ${notebookPageId}`
          );
        else if (safe) return "";
        return link.page_uuid;
      })
  );

const getPageVersion = (pageUuid: string) =>
  s3
    .headObject({
      Bucket: "samepage.network",
      Key: `data/page/${pageUuid}.json`,
    })
    .then((r) => Number(r.Metadata?.index) || 0);

const messageInstance = ({
  source,
  target,
  data,
  messageUuid = v4(),
}: {
  source: { instance: string; app: AppId };
  target: { instance: string; app: AppId };
  messageUuid?: string;
  data: Record<string, unknown>;
}) => {
  return getMysql().then(async (cxn) => {
    const ids = await cxn
      .execute(`SELECT id FROM online_clients WHERE instance = ? AND app = ?`, [
        target.instance,
        target.app,
      ])
      .then((res) => (res as { id: string }[]).map(({ id }) => id));
    const Data = {
      ...data,
      source,
    };
    const online = await Promise.all(
      ids.map((ConnectionId) =>
        postToConnection({
          ConnectionId,
          Data,
        })
          .then(() => true)
          .catch((e) => {
            if (process.env.NODE_ENV === "production") {
              return endClient(ConnectionId, `Missed Message (${e.message})`)
                .then(() => false)
                .catch(() => false);
            } else {
              removeLocalSocket(ConnectionId);
              return false;
            }
          })
      )
    ).then((all) => !!all.length && all.every((i) => i));
    if (!online) {
      await cxn.execute(
        `INSERT INTO messages (uuid, source_instance, source_app, target_instance, target_app, created_date, marked)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          messageUuid,
          source.instance,
          source.app,
          target.instance,
          target.app,
          new Date(),
          0,
        ]
      );
      await uploadFile({
        Key: `data/messages/${messageUuid}.json`,
        Body: JSON.stringify(Data),
      });
    }
  });
};

const logic = async ({
  method,
  app,
  instance,
  pageUuid,
  notebookPageId,
  log,
  localIndex,
  messageUuid,
  request,
  response,
  target,
}: {
  method: string;
  app: AppId;
  instance: string;
  pageUuid: string;
  notebookPageId: string;
  log: Action[];
  localIndex: number;
  messageUuid: string;
  request: string;
  response: Record<string, unknown>;
  target: { instance: string; app: AppId };
}): Promise<string | Record<string, unknown>> => {
  switch (method) {
    case "usage": {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const endDate = new Date(
        currentMonth === 11 ? currentYear + 1 : currentYear,
        currentMonth === 11 ? 0 : currentMonth + 1,
        1
      );
      const startDate = new Date(currentYear, currentMonth, 1).toJSON();

      return getMysql()
        .then(async (cxn) => {
          const [sessions, messages] = await Promise.all([
            cxn
              .execute(
                `SELECT id, created_date, end_date FROM client_sessions WHERE instance = ? AND app = ? AND created_date > ?`,
                [instance, app, startDate]
              )
              .then(
                (items) =>
                  items as { id: string; created_date: Date; end_date: Date }[]
              ),
            cxn
              .execute(
                `SELECT uuid FROM messages WHERE source_instance = ? AND source_app = ? AND date > ?`,
                [instance, app, startDate]
              )
              .then((items) => items as { uuid: string }[]),
          ]);
          cxn.destroy();
          return {
            minutes: sessions.reduce(
              (p, c) => differenceInMinutes(c.created_date, c.end_date) / 5 + p,
              0
            ),
            messages: messages.length,
            date: format(endDate, "MMMM do, yyyy"),
          };
        })
        .catch(catchError("Failed to retrieve usage"));
    }
    case "load-message": {
      return Promise.all([
        downloadFileContent({
          Key: `data/messages/${messageUuid}.json`,
        }).catch(() => {
          console.error(`Could not load message ${messageUuid}`);
          return JSON.stringify("{}");
        }),
        getMysql().then((cxn) => {
          return cxn
            .execute(`UPDATE messages SET marked = ? WHERE uuid = ?`, [
              1,
              messageUuid,
            ])
            .then(() =>
              cxn.execute(
                `SELECT source_instance, source_app FROM messages WHERE uuid = ?`,
                [messageUuid]
              )
            )
            .then((args) => {
              cxn.destroy();
              return args as { source_instance: string; source_app: AppId }[];
            });
        }),
      ])
        .then(([Data, [source]]) => ({
          data: Data,
          source: {
            instance: source.source_instance,
            app: source.source_app,
          },
        }))
        .catch(catchError("Failed to load a message"));
    }
    case "init-shared-page": {
      return getMysql()
        .then(async (cxn) => {
          const results = await cxn.execute(
            `SELECT page_uuid FROM page_instance_links WHERE instance = ? AND app = ? AND notebook_page_id = ?`,
            [instance, app, notebookPageId]
          );
          const [link] = results as { page_uuid: string }[];
          if (link) return { id: link.page_uuid, created: false };
          const pageUuid = v4();
          const args = [pageUuid, notebookPageId, instance, app];
          await cxn.execute(
            `INSERT INTO page_instance_links (uuid, page_uuid, notebook_page_id, instance, app)
            VALUES (UUID(), ?, ?, ?, ?)`,
            args
          );
          cxn.destroy();
          await uploadFile({
            Key: `data/page/${pageUuid}.json`,
            Body: JSON.stringify({ log: [], state: {} }),
            // TODO
            // Metadata: { index: "0" },
          });
          return { created: true, id: pageUuid };
        })
        .catch(catchError("Failed to init a shared page"));
    }
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
            const args = [pageUuid, notebookPageId, instance, app];
            return cxn
              .execute(
                `INSERT INTO page_instance_links (uuid, page_uuid, notebook_page_id, instance, app)
            VALUES (UUID(), ?, ?, ?, ?)`,
                args
              )
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
              .finally(() => cxn.destroy());
          });
        })
        .catch(catchError("Failed to join a shared page"));
    }
    case "update-shared-page": {
      const cxn = await getMysql();
      const pageUuid = await getSharedPage({ instance, notebookPageId, app });
      return (
        !log.length
          ? getPageVersion(pageUuid)
              .then((newIndex) => ({
                newIndex,
              }))
              .catch(
                catchError("Failed to update a shared page with empty log")
              )
          : downloadFileContent({
              Key: `data/page/${pageUuid}.json`,
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
                  Key: `data/page/${pageUuid}.json`,
                  Body: JSON.stringify({ log: updatedLog, state }),
                  // Metadata: { index: updatedLog.length.toString() }, TODO
                }).then(() => updatedLog.length);
              })
              .then((newIndex) => {
                return cxn
                  .execute(
                    `SELECT instance, app FROM page_instance_links WHERE page_uuid = ?`,
                    [pageUuid]
                  )
                  .then((r) => {
                    return Promise.all(
                      (r as { app: AppId; instance: string }[])
                        .filter((item) => {
                          return item.instance !== instance || item.app !== app;
                        })
                        .map((target) =>
                          messageInstance({
                            source: { app, instance },
                            target,
                            data: {
                              log,
                              notebookPageId,
                              index: newIndex,
                              operation: "SHARE_PAGE_UPDATE",
                            },
                          })
                        )
                    );
                  })
                  .then(() => ({
                    newIndex,
                  }));
              })
              .catch(catchError("Failed to update a shared page"))
      ).finally(() => cxn.destroy());
    }
    case "get-shared-page": {
      const cxn = await getMysql();
      return getSharedPage({ instance, notebookPageId, app, safe: true })
        .then((pageUuid) => {
          if (!pageUuid) {
            return { exists: false, log: [] };
          }
          if (typeof localIndex === "undefined") {
            return { exists: true, log: [] };
          }
          return getPageVersion(pageUuid)
            .then((remoteIndex) => {
              if (remoteIndex <= localIndex) {
                return { log: [], exists: true };
              }
              return downloadFileContent({
                Key: `data/page/${pageUuid}.json`,
              }).then((r) => JSON.parse(r));
            })
            .then((r) => ({
              log: (r.log || []).slice(localIndex),
              exists: true,
            }));
        })
        .catch(catchError("Failed to get a shared page"))
        .finally(() => cxn.destroy());
    }
    case "list-page-instances": {
      return getMysql()
        .then(async (cxn) => {
          const pageUuid = await getSharedPage({
            instance,
            notebookPageId,
            app,
          });
          const notebooks = await cxn
            .execute(
              `SELECT app, instance FROM page_instance_links WHERE page_uuid = ?`,
              [pageUuid]
            )
            .then((res) => res as { app: string; instance: string }[]);
          cxn.destroy();
          return { notebooks };
        })
        .catch(catchError("Failed to retrieve page instances"));
    }
    case "list-shared-pages": {
      return getMysql()
        .then(async (cxn) => {
          const pages = await cxn
            .execute(
              `SELECT page_uuid, notebook_page_id FROM page_instance_links
          WHERE instance = ? AND app = ?`,
              [instance, app]
            )
            .then(
              (r) => r as { page_uuid: string; notebook_page_id: string }[]
            );
          const entries = await Promise.all(
            pages.map((p) =>
              getPageVersion(p.page_uuid).then((index) => [
                p.notebook_page_id,
                index,
              ])
            )
          );
          cxn.destroy();
          return entries;
        })
        .then((entries) => ({ indices: Object.fromEntries(entries) }))
        .catch(catchError("Failed to retrieve shared pages"));
    }
    case "disconnect-shared-page": {
      const cxn = await getMysql();
      return (
        getSharedPage({ instance, notebookPageId, app })
          .then(() =>
            cxn.execute(
              `DELETE FROM page_instance_links WHERE instance = ? AND app = ? AND notebook_page_id = ?`,
              [instance, app, notebookPageId]
            )
          )
          // TODO: Let errbody know
          .then(() => ({ success: true }))
          .catch(catchError("Failed to disconnect a shared page"))
          .finally(() => cxn.destroy())
      );
    }
    case "query": {
      const [targetInstance] = request.split(":");
      const hash = crypto.createHash("md5").update(request).digest("hex");
      return downloadFileContent({ Key: `data/queries/${hash}.json` })
        .then((r) => {
          if (r)
            return {
              node: JSON.parse(r),
              found: true,
              fromCache: true,
              ephemeral: true,
            };
          else return { found: false };
        })
        .then((body) =>
          messageInstance({
            source: { instance, app },
            target: { instance: targetInstance, app: 1 },
            data: {
              request,
              operation: "QUERY",
            },
            messageUuid: v4(),
          }).then(() => body)
        )
        .catch(catchError("Failed to query across notebooks"));
    }
    case "query-response": {
      const hash = crypto.createHash("md5").update(request).digest("hex");
      await uploadFile({
        Body: JSON.stringify(response),
        Key: `data/queries/${hash}.json`,
      });
      return messageInstance({
        target,
        source: { instance, app },
        data: {
          method: `QUERY_RESPONSE`,
          ephemeral: true,
          ...response,
        },
        messageUuid: v4(),
      })
        .then(() => ({}))
        .catch(catchError("Failed to respond to query"));
    }
    default:
      throw new NotFoundError(`Unknown method: ${method}`);
  }
};

export const handler = createAPIGatewayProxyHandler(logic);
