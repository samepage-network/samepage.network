import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import { AppId, appNameById, Notebook, Schema } from "@samepage/shared";
import {
  BadRequestError,
  NotFoundError,
} from "@dvargas92495/app/backend/errors.server";
import catchError from "~/data/catchError.server";
import getMysql from "@dvargas92495/app/backend/mysql.server";
import { downloadFileContent } from "@dvargas92495/app/backend/downloadFile.server";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import { v4 } from "uuid";
import messageNotebook from "~/data/messageNotebook.server";
import differenceInMinutes from "date-fns/differenceInMinutes";
import format from "date-fns/format";
import crypto from "crypto";
import getSharedPage from "~/data/getSharedPage.server";
import Automerge from "automerge";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import saveSharedPage from "~/data/saveSharedPage.server";

type Method = Notebook & { requestId: string } & (
    | { method: "usage" }
    | {
        method: "load-message";
        messageUuid: string;
      }
    | {
        method: "init-shared-page";
        notebookPageId: string;
        state: string;
      }
    | {
        method: "join-shared-page";
        pageUuid: string;
        notebookPageId: string;
      }
    | {
        method: "update-shared-page";
        notebookPageId: string;
        changes: string[];
      }
    | {
        method: "force-push-page";
        notebookPageId: string;
        state: string;
      }
    | {
        method: "get-shared-page";
        notebookPageId: string;
        download: boolean;
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
    | {
        oldNotebookPageId: string;
        newNotebookPageId: string;
        method: "link-different-page";
      }
    | {
        method: "save-page-version";
        notebookPageId: string;
        version: number;
      }
  );

const getActorId = () =>
  `SamePage/mainnet`
    .split("")
    .map((s) => s.charCodeAt(0).toString(16))
    .join("");

const loadAutomerge = (binary: Automerge.BinaryDocument) => {
  try {
    return Automerge.load<Schema>(binary, { actorId: getActorId() });
  } catch (e) {
    console.error(`Corrupt automerge file. Returning an empty one instead.`);
    return Automerge.init<Schema>({ actorId: getActorId() });
  }
};

const logic = async (
  req: Method
): Promise<string | Record<string, unknown>> => {
  const { app, workspace, ...args } = req;
  console.log("Received method:", args.method);
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

      return getMysql(req.requestId)
        .then(async (cxn) => {
          const [sessions, messages] = await Promise.all([
            cxn
              .execute(
                `SELECT id, created_date, end_date FROM client_sessions WHERE instance = ? AND app = ? AND created_date > ?`,
                [workspace, app, startDate]
              )
              .then(
                ([items]) =>
                  items as { id: string; created_date: Date; end_date: Date }[]
              ),
            cxn
              .execute(
                `SELECT uuid FROM messages WHERE source_instance = ? AND source_app = ? AND created_date > ?`,
                [workspace, app, startDate]
              )
              .then(([items]) => items as { uuid: string }[]),
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
        getMysql(req.requestId).then((cxn) => {
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
            .then(([args]) => {
              cxn.destroy();
              return args as { source_instance: string; source_app: AppId }[];
            });
        }),
      ])
        .then(([Data, [source]]) => ({
          data: Data,
          source: {
            workspace: source.source_instance,
            app: source.source_app,
          },
        }))
        .catch(catchError("Failed to load a message"));
    }
    case "init-shared-page": {
      const { notebookPageId, state } = args;
      if (!notebookPageId) {
        throw new BadRequestError(
          `Missing notebookPageId for notebook: ${app} / ${workspace}`
        );
      }
      return getMysql(req.requestId)
        .then(async (cxn) => {
          const [results] = await cxn.execute(
            `SELECT page_uuid FROM page_notebook_links WHERE workspace = ? AND app = ? AND notebook_page_id = ?`,
            [workspace, app, notebookPageId]
          );
          const [link] = results as { page_uuid: string }[];
          if (link) return { id: link.page_uuid, created: false };
          const pageUuid = v4();
          const args = [pageUuid, notebookPageId, workspace, app];
          await saveSharedPage({
            pageUuid,
            doc: state,
            requestId: req.requestId,
          });
          await cxn.execute(
            `INSERT INTO pages (uuid, version)
            VALUES (?, 0)`,
            [pageUuid]
          );
          await cxn.execute(
            `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, workspace, app)
            VALUES (UUID(), ?, ?, ?, ?)`,
            args
          );
          cxn.destroy();
          return { created: true, id: pageUuid };
        })
        .catch(catchError("Failed to init a shared page"));
    }
    case "join-shared-page": {
      const { pageUuid, notebookPageId } = args;
      if (!notebookPageId) {
        throw new BadRequestError("`notebookPageId` is required");
      }
      // could replace with sql check
      return downloadSharedPage(pageUuid)
        .then((state) => {
          return getMysql(req.requestId).then(async (cxn) => {
            const results = await cxn
              .execute(
                `SELECT uuid, notebook_page_id FROM page_notebook_links WHERE page_uuid = ? AND workspace = ? AND app = ?`,
                [pageUuid, workspace, app]
              )
              .then(([a]) => a as { uuid: string; notebook_page_id: string }[]);
            const b64State = Buffer.from(state).toString("base64");
            if (!results.length) {
              const uuid = v4();
              await cxn.execute(
                `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, workspace, app)
          VALUES (?, ?, ?, ?, ?)`,
                [uuid, pageUuid, notebookPageId, workspace, app]
              );
              cxn.destroy();
              return {
                state: b64State,
                linkCreated: true,
                notebookPageId: uuid,
              };
            } else {
              cxn.destroy();
              return {
                state: b64State,
                linkCreated: false,
                notebookPageId: results[0].notebook_page_id,
              };
            }
          });
        })
        .catch(catchError("Failed to join a shared page"));
    }
    case "update-shared-page": {
      const { notebookPageId, changes } = args;
      const cxn = await getMysql(req.requestId);
      const { uuid: pageUuid } = await getSharedPage({
        workspace,
        notebookPageId,
        app,
        requestId: req.requestId,
      });
      if (!changes.length) {
        cxn.destroy();
        return {};
      }
      return downloadSharedPage(pageUuid)
        .then(async (binary) => {
          const oldDoc = loadAutomerge(binary);
          const binaryChanges = changes.map(
            (c) =>
              new Uint8Array(
                Buffer.from(c, "base64")
                  .toString("binary")
                  .split("")
                  .map((c) => c.charCodeAt(0))
              ) as Automerge.BinaryChange
          );
          const [newDoc, patch] = Automerge.applyChanges(oldDoc, binaryChanges);
          const { time } = Automerge.decodeChange(
            Automerge.getLastLocalChange(newDoc)
          );
          return Promise.all([
            saveSharedPage({
              pageUuid,
              doc: newDoc,
              requestId: req.requestId,
            }).then(() => patch),
            cxn.execute(
              `UPDATE page_notebook_links SET version = ? WHERE app = ? AND workspace = ? AND notebook_page_id = ?`,
              [time, app, workspace, notebookPageId]
            ),
          ]);
        })
        .then(([patch]) => {
          return cxn
            .execute(
              `SELECT workspace, app, notebook_page_id FROM page_notebook_links WHERE page_uuid = ?`,
              [pageUuid]
            )
            .then(([r]) => {
              return Promise.all(
                (r as (Notebook & { notebook_page_id: string })[])
                  .filter((item) => {
                    return item.workspace !== workspace || item.app !== app;
                  })
                  .map(({ notebook_page_id, ...target }) =>
                    messageNotebook({
                      source: { app, workspace },
                      target,
                      data: {
                        changes,
                        notebookPageId: notebook_page_id,
                        operation: "SHARE_PAGE_UPDATE",
                      },
                      requestId: req.requestId,
                    })
                  )
              );
            })
            .then(() => ({
              patch,
            }));
        })
        .catch(catchError("Failed to update a shared page"))
        .finally(() => {
          cxn.destroy();
        });
    }
    case "force-push-page": {
      const { notebookPageId, state } = args;
      const cxn = await getMysql(req.requestId);
      const { uuid: pageUuid } = await getSharedPage({
        workspace,
        notebookPageId,
        app,
        requestId: req.requestId,
      });

      return saveSharedPage({ pageUuid, doc: state, requestId: req.requestId })
        .then(() => {
          return cxn
            .execute(
              `SELECT workspace, app, notebook_page_id FROM page_notebook_links WHERE page_uuid = ?`,
              [pageUuid]
            )
            .then(([r]) => {
              return Promise.all(
                (r as (Notebook & { notebook_page_id: string })[])
                  .filter((item) => {
                    return item.workspace !== workspace || item.app !== app;
                  })
                  .map(({ notebook_page_id, ...target }) =>
                    messageNotebook({
                      source: { app, workspace },
                      target,
                      data: {
                        state,
                        notebookPageId: notebook_page_id,
                        operation: "SHARE_PAGE_FORCE",
                      },
                      requestId: req.requestId,
                    })
                  )
              );
            })
            .then(() => ({
              success: true,
            }));
        })
        .catch(catchError("Failed to force push a shared page"))
        .finally(() => cxn.destroy());
    }
    case "get-shared-page": {
      const { notebookPageId, download } = args;
      const cxn = await getMysql(req.requestId);
      return getSharedPage({
        workspace,
        notebookPageId,
        app,
        safe: true,
        requestId: req.requestId,
      })
        .then((page) => {
          if (!page) {
            return { exists: false, uuid: "" };
          }
          const { uuid: pageUuid } = page;
          if (!download) {
            return { exists: true, uuid: pageUuid };
          }
          return downloadSharedPage(pageUuid).then((state) => ({
            state: Buffer.from(state).toString("base64"),
            exists: true,
            uuid: pageUuid,
          }));
        })
        .catch(catchError("Failed to get a shared page"))
        .finally(() => cxn.destroy());
    }
    case "list-page-notebooks": {
      const { notebookPageId } = args;
      return getMysql(req.requestId)
        .then(async (cxn) => {
          const { uuid: pageUuid, version } = await getSharedPage({
            workspace,
            notebookPageId,
            app,
            requestId: req.requestId,
          });
          // TODO cache versions in page_notebook_links
          const clients = await cxn
            .execute(
              `SELECT app, workspace FROM page_notebook_links WHERE page_uuid = ?`,
              [pageUuid]
            )
            .then(([res]) => res as Notebook[]);
          cxn.destroy();
          return {
            notebooks: clients.map((c) => ({
              workspace: c.workspace,
              app: appNameById[c.app] as string,
              version: 0,
            })),
            networks: [
              {
                app: "SamePage",
                workspace: "mainnet",
                version,
              },
            ],
          };
        })
        .catch(catchError("Failed to retrieve page notebooks"));
    }
    case "list-shared-pages": {
      return getMysql(req.requestId)
        .then(async (cxn) => {
          const entries = await cxn
            .execute(
              `SELECT l.notebook_page_id 
              FROM page_notebook_links l
              INNER JOIN pages p ON l.page_uuid = p.uuid
          WHERE l.workspace = ? AND l.app = ?`,
              [workspace, app]
            )
            .then(([r]) => r as { notebook_page_id: string }[])
            .then((r) => r.map(({ notebook_page_id }) => notebook_page_id));
          cxn.destroy();
          return entries;
        })
        .then((notebookPageIds) => ({ notebookPageIds }))
        .catch(catchError("Failed to retrieve shared pages"));
    }
    case "disconnect-shared-page": {
      const { notebookPageId } = args;
      const cxn = await getMysql(req.requestId);
      return (
        getSharedPage({
          workspace,
          notebookPageId,
          app,
          requestId: req.requestId,
        })
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
      const [targetWorkspace] = request.split(":");
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
            target: { workspace: targetWorkspace, app: 1 },
            data: {
              request,
              operation: "QUERY",
            },
            messageUuid: v4(),
            requestId: req.requestId,
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
        requestId: req.requestId,
      })
        .then(() => ({ success: true }))
        .catch(catchError("Failed to respond to query"));
    }
    case "link-different-page": {
      const { oldNotebookPageId, newNotebookPageId } = args;
      const cxn = await getMysql(req.requestId);
      const [result] = await cxn
        .execute(
          `SELECT uuid FROM page_notebook_links WHERE app = ? AND workspace = ? AND notebook_page_id = ?`,
          [app, workspace, oldNotebookPageId]
        )
        .then(([a]) => a as { uuid: string }[]);
      if (!result) {
        throw new NotFoundError(
          `Couldn't find old notebook page id: ${oldNotebookPageId}`
        );
      }
      await cxn.execute(
        `UPDATE page_notebook_links SET notebook_page_id = ? WHERE uuid = ?`,
        [newNotebookPageId, result.uuid]
      );
      cxn.destroy();
      return { success: true };
    }
    case "save-page-version": {
      const { version, notebookPageId } = args;
      const cxn = await getMysql(req.requestId);
      await cxn.execute(
        `UPDATE page_notebook_links SET version = ? WHERE app = ? AND workspace = ? AND notebook_page_id = ?`,
        [version, app, workspace, notebookPageId]
      );
      cxn.destroy();
      return { success: true };
    }
    default:
      throw new NotFoundError(`Unknown method: ${JSON.stringify(args)}`);
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: ["https://roamresearch.com", "https://logseq.com"],
});
