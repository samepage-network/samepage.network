import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import {
  Notebook,
  zHeaders,
  zMethodBody,
} from "package/types";
import { appsById } from "package/internal/apps";
import {
  BadRequestError,
  ConflictError,
  MethodNotAllowedError,
  NotFoundError,
} from "@dvargas92495/app/backend/errors.server";
import catchError from "~/data/catchError.server";
import getMysql from "fuegojs/utils/mysql";
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
import getNotebookUuid from "~/data/getNotebookUuid.server";
import authenticateNotebook from "~/data/authenticateNotebook.server";

const zMethod = z.intersection(zHeaders, zMethodBody);

const logic = async (req: Record<string, unknown>) => {
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
        .map((s) => `- ${s}\n`)
        .join("")}`
    );
  const { requestId, notebookUuid, token, ...args } = result.data;
  console.log("Received method:", args.method, "from", notebookUuid);
  const cxn = await getMysql(requestId);
  try {
    if (args.method === "create-notebook") {
      const { inviteCode, app, workspace } = args;
      // TODO - Invite code and api token are currently the same.
      // Invite code should be short lived, token long live and encrypted at rest
      const [results] = await cxn.execute(
        `SELECT uuid FROM tokens where value = ?`,
        [inviteCode]
      );
      const [tokenUuid] = results as { uuid: string }[];
      if (!tokenUuid) {
        throw new NotFoundError("Could not find valid token");
      }
      const [tokenLinks] = await cxn.execute(
        `SELECT l.uuid FROM token_notebook_links l
      where l.token_uuid = ?`,
        [tokenUuid.uuid]
      );
      if ((tokenLinks as { uuid: string }[]).length >= 5) {
        throw new ConflictError(
          `Maximum number of notebooks allowed to be connected to this token is 5.`
        );
      }
      const [existingNotebooks] = await cxn.execute(
        `SELECT n.uuid FROM notebooks n
      LEFT JOIN token_notebook_links l ON l.notebook_uuid = n.uuid
      where n.workspace = ? and n.app = ? and l.token_uuid is NULL`,
        [workspace, app]
      );
      const [potentialNotebookUuid] = existingNotebooks as { uuid: string }[];
      const notebookUuid =
        potentialNotebookUuid?.uuid ||
        (await Promise.resolve(v4()).then((uuid) =>
          cxn
            .execute(
              `INSERT INTO notebooks (uuid, app, workspace)
      VALUES (?, ?, ?)`,
              [uuid, app, workspace]
            )
            .then(() => uuid)
        ));
      await cxn.execute(
        `INSERT INTO token_notebook_links (uuid, token_uuid, notebook_uuid)
        VALUES (UUID(), ?, ?)`,
        [tokenUuid.uuid, notebookUuid]
      );
      cxn.destroy();
      return { notebookUuid };
    }
    if (!notebookUuid)
      throw new BadRequestError(
        `Notebook Universal ID is required to use SamePage`
      );
    if (!token)
      throw new BadRequestError(`Notebook Token is required to use SamePage`);
    await authenticateNotebook({ requestId, notebookUuid, token });
    switch (args.method) {
      case "connect-notebook": {
        // all the work is done in authenticate...
        return { success: true };
      }
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
                  `SELECT id, created_date, end_date FROM client_sessions WHERE notebook_uuid = ? AND created_date > ?`,
                  [notebookUuid, startDate]
                )
                .then(
                  ([items]) =>
                    items as {
                      id: string;
                      created_date: Date;
                      end_date: Date;
                    }[]
                ),
              cxn
                .execute(
                  `SELECT uuid FROM messages WHERE source = ? AND created_date > ?`,
                  [notebookUuid, startDate]
                )
                .then(([items]) => items as { uuid: string }[]),
            ]);
            cxn.destroy();
            return {
              minutes: sessions.reduce(
                (p, c) =>
                  differenceInMinutes(c.created_date, c.end_date) / 5 + p,
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
                  `SELECT n.* FROM messages m INNER JOIN notebooks n ON n.uuid = m.source WHERE m.uuid = ?`,
                  [messageUuid]
                )
              )
              .then(([args]) => {
                cxn.destroy();
                return args as (Notebook & { uuid: string })[];
              });
          }),
        ])
          .then(([Data, [source]]) => {
            if (!source) {
              throw new NotFoundError(`No message: ${messageUuid} exists`);
            }
            return {
              data: Data,
              source,
            };
          })
          .catch(catchError("Failed to load a message"));
      }
      case "init-shared-page": {
        const { notebookPageId, state } = args;
        return getMysql(requestId)
          .then(async (cxn) => {
            const [results] = await cxn.execute(
              `SELECT page_uuid FROM page_notebook_links WHERE notebook_uuid = ? AND notebook_page_id = ?`,
              [notebookUuid, notebookPageId]
            );
            const [link] = results as { page_uuid: string }[];
            if (link) return { id: link.page_uuid, created: false };
            const pageUuid = v4();
            const { cid, body } = await saveSharedPage({
              doc: state,
            });
            // TODO - do we even need version here???
            await cxn.execute(
              `INSERT INTO pages (uuid, version)
            VALUES (?, 0)`,
              [pageUuid]
            );
            await cxn.execute(
              `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, version, open, invited_by, invited_date, notebook_uuid, cid)
            VALUES (UUID(), ?, ?, ?, 0, ?, ?, ?, ?)`,
              [
                pageUuid,
                notebookPageId,
                Automerge.getHistory(Automerge.load(body)).slice(-1)?.[0]
                  ?.change?.time,
                notebookUuid,
                new Date(),
                notebookUuid,
                cid,
              ]
            );
            cxn.destroy();
            return { created: true, id: pageUuid };
          })
          .catch(catchError("Failed to init a shared page"));
      }
      case "join-shared-page": {
        const { notebookPageId } = args;
        const results = await cxn
          .execute(
            `SELECT uuid, page_uuid, invited_by FROM page_notebook_links WHERE notebook_page_id = ? AND notebook_uuid = ? AND open = 1`,
            [notebookPageId, notebookUuid]
          )
          .then(
            ([a]) =>
              a as {
                uuid: string;
                page_uuid: string;
                invited_by: string;
              }[]
          );
        if (!results.length) {
          cxn.destroy();
          return {
            found: false,
          };
        }
        const { uuid, page_uuid, invited_by } = results[0];
        const invitedByResults = await cxn
          .execute(
            `SELECT cid FROM page_notebook_links WHERE page_uuid = ? AND open = 0 AND notebook_uuid = ?`,
            [page_uuid, invited_by]
          )
          .then(
            ([a]) =>
              a as {
                cid: string;
              }[]
          );
        if (!invitedByResults.length) {
          cxn.destroy();
          return {
            found: false,
          };
        }
        const { body: state } = await downloadSharedPage({
          cid: invitedByResults[0].cid,
        });
        const { cid } = await saveSharedPage({ doc: state });
        await cxn.execute(
          `UPDATE page_notebook_links SET open = 0, cid = ?, version = ? WHERE uuid = ?`,
          [
            cid,
            Automerge.getHistory(Automerge.load(state)).slice(-1)[0]?.change
              ?.time,
            uuid,
          ]
        );
        await messageNotebook({
          target: invited_by,
          source: notebookUuid,
          data: {
            operation: "SHARE_PAGE_RESPONSE",
            success: true,
            title: notebookPageId,
          },
          requestId,
        });
        cxn.destroy();
        const b64State = Buffer.from(state).toString("base64");
        return {
          state: b64State,
          found: true,
        };
      }
      case "update-shared-page": {
        const { notebookPageId, changes, state } = args;
        const { uuid: pageUuid, cid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        if (!changes.length) {
          cxn.destroy();
          return {};
        }
        await cxn
          .execute(
            `SELECT notebook_uuid, notebook_page_id FROM page_notebook_links WHERE page_uuid = ? AND open = 0`,
            [pageUuid]
          )
          .then(([r]) => {
            const clients = (
              r as {
                notebook_page_id: string;
                notebook_uuid: string;
              }[]
            ).filter((item) => {
              return notebookUuid !== item.notebook_uuid;
            });
            return Promise.all(
              clients.map(({ notebook_page_id, notebook_uuid: target }) =>
                messageNotebook({
                  source: notebookUuid,
                  target,
                  data: {
                    changes,
                    notebookPageId: notebook_page_id,
                    operation: "SHARE_PAGE_UPDATE",
                  },
                  requestId,
                })
              )
            );
          });
        const res = await saveSharedPage({
          cid,
          doc: state,
        });
        await cxn.execute(
          `UPDATE page_notebook_links SET version = ?, cid = ? WHERE notebook_uuid = ? AND notebook_page_id = ?`,
          [
            Automerge.getHistory(Automerge.load(res.body)).slice(-1)[0]?.change
              ?.time,
            res.cid,
            notebookUuid,
            notebookPageId,
          ]
        );
        cxn.destroy();
        return {
          success: true,
        };
      }
      case "force-push-page": {
        const { notebookPageId, state: inputState } = args;
        const { uuid: pageUuid, cid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        const state = await (inputState
          ? saveSharedPage({ doc: inputState, cid })
              .then((res) =>
                cxn.execute(
                  `UPDATE page_notebook_links SET version = ?, cid = ? WHERE notebook_uuid = ? AND notebook_page_id = ?`,
                  [
                    Automerge.getHistory(Automerge.load(res.body)).slice(-1)[0]
                      ?.change?.time,
                    res.cid,
                    notebookUuid,
                    notebookPageId,
                  ]
                )
              )
              .then(() => inputState)
          : downloadSharedPage({ cid }).then((b) =>
              Buffer.from(b.body).toString("base64")
            ));
        const notebooks = await cxn
          .execute(
            `SELECT notebook_page_id, notebook_uuid FROM page_notebook_links WHERE page_uuid = ? AND open = 0`,
            [pageUuid]
          )
          .then(
            ([r]) =>
              r as {
                notebook_page_id: string;
                notebook_uuid: string;
              }[]
          );
        await Promise.all(
          notebooks
            .filter((item) => {
              return item.notebook_uuid !== notebookUuid;
            })
            .map(({ notebook_page_id, notebook_uuid: target }) =>
              messageNotebook({
                source: notebookUuid,
                target,
                data: {
                  state,
                  notebookPageId: notebook_page_id,
                  operation: "SHARE_PAGE_FORCE",
                },
                requestId,
              })
            )
        );
        cxn.destroy();

        return {
          success: true,
        };
      }
      case "invite-notebook-to-page": {
        const { notebookPageId, target } = args;
        return Promise.all([
          getSharedPage({
            notebookUuid,
            notebookPageId,
            requestId,
          }),
          getSharedPage({
            notebookUuid: await getNotebookUuid({ ...target, requestId }),
            notebookPageId,
            safe: true,
            requestId,
          }),
        ])
          .then(async ([page, targetPage]) => {
            if (!page) {
              throw new NotFoundError(
                `Attempted to invite a notebook to a page that isn't shared.`
              );
            }
            if (targetPage) {
              throw new MethodNotAllowedError(
                `Attempted to invite a notebook to a page that was already shared with it`
              );
            }
            const { uuid: pageUuid } = page;
            const targetNotebookUuid = await getNotebookUuid({
              ...target,
              requestId,
            });
            await cxn.execute(
              `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, version, open, invited_by, invited_date, notebook_uuid)
            VALUES (UUID(), ?, ?, ?, ?, 0, 1, ?, ?, ?)`,
              [
                pageUuid,
                notebookPageId,
                notebookUuid,
                new Date(),
                targetNotebookUuid,
              ]
            );
            return messageNotebook({
              source: notebookUuid,
              target: targetNotebookUuid,
              data: {
                notebookPageId,
                pageUuid,
                operation: "SHARE_PAGE",
              },
              requestId: requestId,
            }).then(() => ({ success: true }));
          })
          .catch(catchError("Failed to invite notebook to a shared page"))
          .finally(() => cxn.destroy());
      }
      case "remove-page-invite": {
        const { notebookPageId, target } = args;
        const { linkUuid, invitedBy } = await (target
          ? cxn
              .execute(
                `SELECT uuid 
      FROM page_notebook_links l
      INNER JOIN notebooks n ON n.uuid = l.notebook_uuid
      WHERE n.workspace = ? AND n.app = ? AND l.notebook_page_id = ? AND l.open = 1 AND l.invited_by = ?`,
                [target.workspace, target.app, notebookPageId, notebookUuid]
              )
              .then(([invitedByLink]) => ({
                invitedBy: notebookUuid,
                linkUuid: (invitedByLink as { uuid: string }[])[0]?.uuid,
              }))
          : cxn
              .execute(
                `SELECT uuid, invited_by
      FROM page_notebook_links
      WHERE notebook_uuid = ? AND notebook_page_id = ? AND open = 1`,
                [notebookUuid, notebookPageId]
              )
              .then(async ([link]) => {
                const { uuid, invited_by } =
                  (link as { uuid: string; invited_by: string }[])[0] || {};
                const [invitedBy] = await cxn
                  .execute(
                    `SELECT notebook_uuid FROM notebooks WHERE uuid = ?`,
                    [invited_by]
                  )
                  .then(([a]) => a as { notebook_uuid: string }[]);
                return { linkUuid: uuid, invitedBy: invitedBy?.notebook_uuid };
              }));
        if (!linkUuid) {
          throw new NotFoundError(`Could not find valid invite to remove.`);
        }
        return cxn
          .execute(`DELETE FROM page_notebook_links WHERE uuid = ?`, [linkUuid])
          .then(() =>
            messageNotebook({
              source: notebookUuid,
              target: invitedBy,
              data: {
                title: notebookPageId,
                rejected: !target,
                success: false,
                operation: "SHARE_PAGE_RESPONSE",
              },
              requestId,
            })
          )
          .then(() => ({ success: true }))
          .catch(catchError("Failed to remove a shared page"))
          .finally(() => cxn.destroy());
      }
      case "list-page-notebooks": {
        const { notebookPageId } = args;
        return getMysql(requestId)
          .then(async (cxn) => {
            const { uuid: pageUuid } = await getSharedPage({
              notebookUuid,
              notebookPageId,
              requestId: requestId,
            });
            const clients = await cxn
              .execute(
                `SELECT n.app, n.workspace, l.version, l.open FROM page_notebook_links l 
                INNER JOIN notebooks n ON n.uuid = l.notebook_uuid 
                WHERE l.page_uuid = ?`,
                [pageUuid]
              )
              .then(
                ([res]) =>
                  res as (Notebook & { version: number; open: 0 | 1 })[]
              );
            cxn.destroy();
            return {
              notebooks: clients.map((c) => ({
                workspace: c.workspace,
                app: appsById[c.app].name,
                version: c.version,
                openInvite: !!c.open,
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
          WHERE l.notebook_uuid = ? AND l.open = 0`,
                [notebookUuid]
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
        return (
          getSharedPage({
            notebookUuid,
            notebookPageId,
            requestId,
          })
            .then(() =>
              cxn.execute(
                `DELETE FROM page_notebook_links WHERE notebook_uuid = ? AND notebook_page_id = ?`,
                [notebookUuid, notebookPageId]
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
          .then(async (body) =>
            messageNotebook({
              source: notebookUuid,
              target: await getNotebookUuid({
                workspace: targetWorkspace,
                app: 1,
                requestId,
              }),
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
          target: await getNotebookUuid({ ...target, requestId }),
          source: notebookUuid,
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
        const [result] = await cxn
          .execute(
            `SELECT uuid FROM page_notebook_links WHERE notebook_uuid = ? AND notebook_page_id = ?`,
            [notebookUuid, oldNotebookPageId]
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
        const { state, notebookPageId } = args;
        const { cid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        const res = await saveSharedPage({ cid, doc: state });
        await cxn.execute(
          `UPDATE page_notebook_links SET version = ?, cid = ? WHERE notebook_uuid = ? AND notebook_page_id = ?`,
          [
            Automerge.getHistory(Automerge.load(res.body)).slice(-1)[0]?.change
              ?.time,
            res.cid,
            notebookUuid,
            notebookPageId,
          ]
        );
        cxn.destroy();
        return { success: true };
      }
      case "get-ipfs-cid": {
        const { notebookPageId } = args;
        const { cid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        cxn.destroy();
        return { cid };
      }
      case "get-shared-page": {
        const { notebookPageId } = args;
        const { cid } = await getSharedPage({
          notebookUuid,
          requestId,
          notebookPageId,
        });
        const { body: state } = await downloadSharedPage({ cid });
        cxn.destroy();
        return { state: Buffer.from(state).toString("base64") };
      }
      default:
        throw new NotFoundError(`Unknown method: ${JSON.stringify(args)}`);
    }
  } catch (e) {
    cxn.destroy();
    return catchError(`Failed to process method: ${args.method}`)(e as Error);
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [
    "https://roamresearch.com",
    "https://logseq.com",
    "app://obsidian.md",
  ],
});
