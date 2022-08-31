import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import type { AppId, Notebook, Schema } from "client/src/types";
import { appsById } from "client/src/internal/apps";
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
import { z } from "zod";

const zNotebook = z.object({
  workspace: z.string(),
  app: z.number().transform((n) => n as AppId),
});

const zMethod = z.intersection(
  zNotebook.merge(
    z.object({
      requestId: z.string(),
    })
  ),
  z.discriminatedUnion("method", [
    z.object({ method: z.literal("usage") }),
    z.object({ method: z.literal("load-message"), messageUuid: z.string() }),
    z.object({
      method: z.literal("init-shared-page"),
      notebookPageId: z.string(),
      state: z.string(),
    }),
    z.object({
      method: z.literal("join-shared-page"),
      pageUuid: z.string(),
      notebookPageId: z.string(),
    }),
    z.object({
      method: z.literal("update-shared-page"),
      notebookPageId: z.string(),
      changes: z.string().array(),
    }),
    z.object({
      method: z.literal("force-push-page"),
      notebookPageId: z.string(),
      state: z.string(),
    }),
    z.object({
      method: z.literal("get-shared-page"),
      notebookPageId: z.string(),
      download: z.boolean(),
    }),
    z.object({
      method: z.literal("list-page-notebooks"),
      notebookPageId: z.string(),
    }),
    z.object({
      method: z.literal("list-shared-pages"),
    }),
    z.object({
      method: z.literal("disconnect-shared-page"),
      notebookPageId: z.string(),
    }),
    z.object({ method: z.literal("query"), request: z.string() }),
    z.object({
      method: z.literal("query-response"),
      response: z.string(),
      request: z.string(),
      target: zNotebook,
    }),
    z.object({
      oldNotebookPageId: z.string(),
      newNotebookPageId: z.string(),
      method: z.literal("link-different-page"),
    }),
    z.object({
      method: z.literal("save-page-version"),
      notebookPageId: z.string(),
      version: z.number(),
    }),
  ])
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
  req: Record<string, unknown>
): Promise<string | Record<string, unknown>> => {
  const result = zMethod.safeParse(req);
  if (!result.success)
    throw new BadRequestError(
      `Failed to parse request. Errors:\n${result.error.issues
        .map((i) =>
          i.code === "invalid_type"
            ? `Expected \`${i.path.join(".")}\` to be of type \`${
                i.expected
              }\` but received type \`${i.received}\``
            : i.message
        )
        .map((s) => `- ${s}\n`)}`
    );
  const { app, workspace, requestId, ...args } = result.data;
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

      return getMysql(requestId)
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
        getMysql(requestId).then((cxn) => {
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
      return getMysql(requestId)
        .then(async (cxn) => {
          const [results] = await cxn.execute(
            `SELECT page_uuid FROM page_notebook_links WHERE workspace = ? AND app = ? AND notebook_page_id = ?`,
            [workspace, app, notebookPageId]
          );
          const [link] = results as { page_uuid: string }[];
          if (link) return { id: link.page_uuid, created: false };
          const pageUuid = v4();
          const { version } = await saveSharedPage({
            pageUuid,
            doc: state,
            requestId: requestId,
          });
          await cxn.execute(
            `INSERT INTO pages (uuid, version)
            VALUES (?, 0)`,
            [pageUuid]
          );
          await cxn.execute(
            `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, workspace, app, version)
            VALUES (UUID(), ?, ?, ?, ?, ?)`,
            [pageUuid, notebookPageId, workspace, app, version]
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
          return getMysql(requestId).then(async (cxn) => {
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
                `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, workspace, app, version)
          VALUES (?, ?, ?, ?, ?, 0)`,
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
      const cxn = await getMysql(requestId);
      const { uuid: pageUuid } = await getSharedPage({
        workspace,
        notebookPageId,
        app,
        requestId: requestId,
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
          return saveSharedPage({
            pageUuid,
            doc: newDoc,
            requestId: requestId,
          }).then(({ version }) =>
            cxn
              .execute(
                `UPDATE page_notebook_links SET version = ? WHERE app = ? AND workspace = ? AND notebook_page_id = ?`,
                [version, app, workspace, notebookPageId]
              )
              .then(() => patch)
          );
        })
        .then((patch) => {
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
                      requestId: requestId,
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
      const cxn = await getMysql(requestId);
      const { uuid: pageUuid } = await getSharedPage({
        workspace,
        notebookPageId,
        app,
        requestId: requestId,
      });

      return saveSharedPage({ pageUuid, doc: state, requestId: requestId })
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
                      requestId: requestId,
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
      const cxn = await getMysql(requestId);
      return getSharedPage({
        workspace,
        notebookPageId,
        app,
        safe: true,
        requestId: requestId,
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
      return getMysql(requestId)
        .then(async (cxn) => {
          const { uuid: pageUuid } = await getSharedPage({
            workspace,
            notebookPageId,
            app,
            requestId: requestId,
          });
          const clients = await cxn
            .execute(
              `SELECT app, workspace, version FROM page_notebook_links WHERE page_uuid = ?`,
              [pageUuid]
            )
            .then(([res]) => res as (Notebook & { version: number })[]);
          cxn.destroy();
          return {
            notebooks: clients.map((c) => ({
              workspace: c.workspace,
              app: appsById[c.app].name,
              version: c.version,
            })),
          };
        })
        .catch(catchError("Failed to retrieve page notebooks"));
    }
    case "list-shared-pages": {
      return getMysql(requestId)
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
      const cxn = await getMysql(requestId);
      return (
        getSharedPage({
          workspace,
          notebookPageId,
          app,
          requestId: requestId,
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
            requestId: requestId,
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
        requestId: requestId,
      })
        .then(() => ({ success: true }))
        .catch(catchError("Failed to respond to query"));
    }
    case "link-different-page": {
      const { oldNotebookPageId, newNotebookPageId } = args;
      const cxn = await getMysql(requestId);
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
      const cxn = await getMysql(requestId);
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
