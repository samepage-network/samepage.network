import createAPIGatewayProxyHandler from "aws-sdk-plus/dist/createAPIGatewayProxyHandler";
import { AppId } from "~/enums/apps";
import { ConflictError, NotFoundError } from "aws-sdk-plus/dist/errors";
import catchError from "~/data/catchError.server";
import getMysql from "@dvargas92495/app/backend/mysql.server";
import { downloadFileContent } from "@dvargas92495/app/backend/downloadFile.server";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import { S3 } from "@aws-sdk/client-s3";
import { v4 } from "uuid";
import messageNotebook from "~/data/messageNotebook.server";
import differenceInMinutes from "date-fns/differenceInMinutes";
import format from "date-fns/format";
import { Action, Notebook } from "~/types";
import crypto from "crypto";

const s3 = new S3({ region: "us-east-1" });

const getSharedPage = ({
  workspace,
  notebookPageId,
  app,
  safe,
}: {
  notebookPageId: string;
  safe?: boolean;
} & Notebook) =>
  getMysql().then((cxn) =>
    cxn
      .execute(
        `SELECT page_uuid FROM page_notebook_links WHERE workspace = ? AND app = ? AND notebook_page_id = ?`,
        [workspace, app, notebookPageId]
      )
      .then((results) => {
        const [link] = results as { page_uuid: string }[];
        if (!link && !safe)
          throw new NotFoundError(
            `Could not find page from app ${app}, workspace ${workspace}, and notebookPageId ${notebookPageId}`
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

type Method = Notebook &
  (
    | { method: "usage" }
    | {
        method: "load-message";
        messageUuid: string;
      }
    | {
        method: "init-shared-page";
        notebookPageId: string;
      }
    | {
        method: "join-shared-page";
        pageUuid: string;
        notebookPageId: string;
      }
    | {
        method: "update-shared-page";
        notebookPageId: string;
        log: Action[];
      }
    | {
        method: "get-shared-page";
        notebookPageId: string;
        localIndex?: number;
      }
    | {
        method: "list-page-notebooks";
        notebookPageId: string;
      }
    | {
        method: "list-shared-pages";
      }
    | {
        method: "disconnect-shared-page";
        notebookPageId: string;
      }
    | { method: "query"; request: string }
    | {
        method: "query-response";
        response: string;
        request: string;
        target: Notebook;
      }
  );

const logic = async (
  req: Method
): Promise<string | Record<string, unknown>> => {
  const { app, workspace, ...args } = req;
  switch (args.method) {
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
                [workspace, app, startDate]
              )
              .then(
                (items) =>
                  items as { id: string; created_date: Date; end_date: Date }[]
              ),
            cxn
              .execute(
                `SELECT uuid FROM messages WHERE source_instance = ? AND source_app = ? AND created_date > ?`,
                [workspace, app, startDate]
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
      const { messageUuid } = args;
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
      const { notebookPageId } = args;
      return getMysql()
        .then(async (cxn) => {
          const results = await cxn.execute(
            `SELECT page_uuid FROM page_notebook_links WHERE workspace = ? AND app = ? AND notebook_page_id = ?`,
            [workspace, app, notebookPageId]
          );
          const [link] = results as { page_uuid: string }[];
          if (link) return { id: link.page_uuid, created: false };
          const pageUuid = v4();
          const args = [pageUuid, notebookPageId, workspace, app];
          await cxn.execute(
            `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, workspace, app)
            VALUES (UUID(), ?, ?, ?, ?)`,
            args
          );
          cxn.destroy();
          await uploadFile({
            Key: `data/page/${pageUuid}.json`,
            Body: JSON.stringify({ log: [], state: {} }),
            Metadata: { index: "0" },
          });
          return { created: true, id: pageUuid };
        })
        .catch(catchError("Failed to init a shared page"));
    }
    case "join-shared-page": {
      const { pageUuid, notebookPageId } = args;
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
            const args = [pageUuid, notebookPageId, workspace, app];
            return cxn
              .execute(
                `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, workspace, app)
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
      const { notebookPageId, log } = args;
      const cxn = await getMysql();
      const pageUuid = await getSharedPage({ workspace, notebookPageId, app });
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
                   Metadata: { index: updatedLog.length.toString() },
                }).then(() => updatedLog.length);
              })
              .then((newIndex) => {
                return cxn
                  .execute(
                    `SELECT workspace, app FROM page_notebook_links WHERE page_uuid = ?`,
                    [pageUuid]
                  )
                  .then((r) => {
                    return Promise.all(
                      (r as { app: AppId; workspace: string }[])
                        .filter((item) => {
                          return (
                            item.workspace !== workspace || item.app !== app
                          );
                        })
                        .map((target) =>
                          messageNotebook({
                            source: { app, workspace },
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
      const { notebookPageId, localIndex } = args;
      const cxn = await getMysql();
      return getSharedPage({ workspace, notebookPageId, app, safe: true })
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
    case "list-page-notebooks": {
      const { notebookPageId } = args;
      return getMysql()
        .then(async (cxn) => {
          const pageUuid = await getSharedPage({
            workspace,
            notebookPageId,
            app,
          });
          const notebooks = await cxn
            .execute(
              `SELECT app, workspace FROM page_notebook_links WHERE page_uuid = ?`,
              [pageUuid]
            )
            .then((res) => res as Notebook[]);
          cxn.destroy();
          return { notebooks };
        })
        .catch(catchError("Failed to retrieve page notebooks"));
    }
    case "list-shared-pages": {
      return getMysql()
        .then(async (cxn) => {
          const pages = await cxn
            .execute(
              `SELECT page_uuid, notebook_page_id FROM page_notebook_links
          WHERE workspace = ? AND app = ?`,
              [workspace, app]
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
      const { notebookPageId } = args;
      const cxn = await getMysql();
      return (
        getSharedPage({ workspace, notebookPageId, app })
          .then(() =>
            cxn.execute(
              `DELETE FROM page_notebook_links WHERE workspace = ? AND app = ? AND notebook_page_id = ?`,
              [workspace, app, notebookPageId]
            )
          )
          // TODO: Let errbody know
          .then(() => ({ success: true }))
          .catch(catchError("Failed to disconnect a shared page"))
          .finally(() => cxn.destroy())
      );
    }
    case "query": {
      const { request } = args;
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
          messageNotebook({
            source: { workspace, app },
            target: { workspace: targetInstance, app: 1 },
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
      const { request, response, target } = args;
      const hash = crypto.createHash("md5").update(request).digest("hex");
      await uploadFile({
        Body: JSON.stringify(response),
        Key: `data/queries/${hash}.json`,
      });
      return messageNotebook({
        target,
        source: { workspace, app },
        data: {
          operation: `QUERY_RESPONSE`,
          ephemeral: true,
          ...JSON.parse(response),
        },
        messageUuid: v4(),
      })
        .then(() => ({ success: true }))
        .catch(catchError("Failed to respond to query"));
    }
    default:
      throw new NotFoundError(`Unknown method: ${JSON.stringify(args)}`);
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: ["https://roamresearch.com"],
});
