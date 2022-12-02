import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import {
  Notebook,
  zAuthHeaders,
  zAuthenticatedBody,
  zUnauthenticatedBody,
  zBaseHeaders,
} from "package/internal/types";
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
import downloadSharedPage from "~/data/downloadSharedPage.server";
import saveSharedPage from "~/data/saveSharedPage.server";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import { Operation } from "package/internal/messages";
import messageToNotification from "package/internal/messageToNotification";
import inviteNotebookToPage from "~/data/inviteNotebookToPage.server";
import getNotebookUuids from "~/data/getNotebookUuids.server";
import getOrGenerateNotebookUuid from "~/data/getOrGenerateNotebookUuid.server";
import createNotebook from "~/data/createNotebook.server";
import QUOTAS from "~/data/quotas.server";
import { ZodError } from "zod";

const zMethod = zUnauthenticatedBody
  .and(zBaseHeaders)
  .or(zAuthenticatedBody.and(zAuthHeaders).and(zBaseHeaders));

const parseZodError = (e: ZodError, indentation = 0): string =>
  e.issues
    .map((i) =>
      i.code === "invalid_type"
        ? `Expected \`${i.path.join(".")}\` to be of type \`${
            i.expected
          }\` but received type \`${i.received}\``
        : i.code === "invalid_union"
        ? `Path ${i.path.join(
            "."
          )} had the following union errors:\n${i.unionErrors
            .map((e) => parseZodError(e, indentation + 1))
            .join("\n")}`
        : `${i.message} (${i.code})`
    )
    .map((s) => `- ${s}\n`)
    .join("");

const getQuota = async ({
  requestId,
  field,
}: {
  requestId: string;
  field: typeof QUOTAS[number];
}) => {
  const cxn = await getMysql(requestId);
  return cxn
    .execute(`SELECT value FROM quotas WHERE field = ? AND stripe_id IS NULL`, [
      QUOTAS.indexOf(field),
    ])
    .then(([q]) => (q as { value: number }[])[0]?.value);
};

const validatePageQuota = async ({
  requestId,
  notebookUuid,
}: {
  requestId: string;
  notebookUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const pageQuota = await getQuota({ requestId, field: "Pages" });
  const totalPages = await cxn
    .execute(
      `SELECT COUNT(page_uuid) as total FROM page_notebook_links WHERE notebook_uuid = ? AND open = 0`,
      [notebookUuid]
    )
    .then(([t]) => (t as { total: number }[])[0]?.total);
  if (totalPages >= pageQuota) {
    throw new ConflictError(
      `Maximum number of pages allowed to be connected to this notebook on this plan is ${pageQuota}.`
    );
  }
};

const logic = async (req: Record<string, unknown>) => {
  const result = zMethod.safeParse(req);
  if (!result.success)
    throw new BadRequestError(
      `Failed to parse request. Errors:\n${parseZodError(result.error)}`
    );
  const { requestId, ...args } = result.data;
  console.log("Received method:", args.method);
  const cxn = await getMysql(requestId);
  try {
    if (args.method === "create-notebook") {
      const { inviteCode, app, workspace } = args;
      const [results] = await cxn.execute(
        `SELECT token_uuid, expiration_date FROM invitations where code = ?`,
        [inviteCode]
      );
      const [invite] = results as {
        token_uuid: string;
        expiration_date: Date;
      }[];
      if (!invite) {
        throw new NotFoundError("Could not find invite");
      }
      if (invite.token_uuid) {
        throw new ConflictError(
          "Invite has already been claimed by a notebook."
        );
      }
      if (new Date().valueOf() >= invite.expiration_date.valueOf()) {
        throw new ConflictError(
          "Invite has expired. Please request a new one from the team."
        );
      }

      const { token, tokenUuid, notebookUuid } = await createNotebook({
        requestId,
        app,
        workspace,
      });
      await cxn.execute(
        `UPDATE invitations SET token_uuid = ? where code = ?`,
        [tokenUuid, inviteCode]
      );
      cxn.destroy();
      return { notebookUuid, token };
    } else if (args.method === "ping") {
      // uptime checker
      console.log("ping");
      return { success: true };
    }
    const { notebookUuid, token } = args;
    if (!notebookUuid)
      throw new BadRequestError(
        `Notebook Universal ID is required to use SamePage`
      );
    if (!token)
      throw new BadRequestError(`Notebook Token is required to use SamePage`);
    const tokenUuid = await authenticateNotebook({
      requestId,
      notebookUuid,
      token,
    });
    console.log("authenticated notebook as", notebookUuid);

    switch (args.method) {
      case "connect-notebook": {
        const { app, workspace } = args;
        const [check] = await cxn.execute(
          `SELECT n.app, n.workspace
          FROM notebooks n
          WHERE n.uuid = ?`,
          [notebookUuid]
        );
        const [existingNotebook] = check as Notebook[];
        if (
          existingNotebook &&
          existingNotebook.app === app &&
          existingNotebook.workspace === workspace
        ) {
          return { notebookUuid };
        }
        const [results] = await cxn.execute(
          `SELECT l.uuid, l.notebook_uuid, n.app, n.workspace FROM token_notebook_links l
          LEFT JOIN notebooks n ON n.uuid = l.notebook_uuid
          where l.token_uuid = ?`,
          [tokenUuid]
        );
        const tokenLinks = results as ({
          uuid: string;
          notebook_uuid: string;
        } & Notebook)[];
        const existingTokenLink = tokenLinks.find(
          (tl) => tl.app === app && tl.workspace === workspace
        );
        if (existingTokenLink) {
          return { notebookUuid: existingTokenLink.notebook_uuid };
        }
        const notebookQuota = await cxn
          .execute(
            `SELECT value FROM quotas WHERE field = ? AND stripe_id IS NULL`,
            [QUOTAS.indexOf("Notebooks")]
          )
          .then(([q]) => (q as { value: number }[])?.[0].value);
        if (tokenLinks.length >= notebookQuota) {
          throw new ConflictError(
            `Maximum number of notebooks allowed to be connected to this token with this plan is ${notebookQuota}.`
          );
        }
        const newNotebookUuid = await getOrGenerateNotebookUuid({
          requestId,
          app,
          workspace,
        });
        await cxn.execute(
          `INSERT INTO token_notebook_links (uuid, token_uuid, notebook_uuid)
          VALUES (UUID(), ?, ?)`,
          [tokenUuid, newNotebookUuid]
        );
        cxn.destroy();
        return { notebookUuid: newNotebookUuid };
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
            const [sessions, messages, notebooks, [quotas]] = await Promise.all(
              [
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
                cxn
                  .execute(
                    `SELECT uuid FROM token_notebook_links WHERE notebook_uuid = ?`,
                    [notebookUuid]
                  )
                  .then(([links]) => links as { uuid: string }[])
                  .then((links) =>
                    cxn.execute(
                      `SELECT n.uuid, n.app, n.workspace, COUNT(l.uuid) as pages
                FROM page_notebook_links l
                INNER JOIN notebooks n ON l.notebook_uuid = n.uuid
                INNER JOIN token_notebook_links tl ON tl.notebook_uuid = n.uuid
                WHERE l.open = 0 AND tl.uuid IN (${links
                  .map(() => "?")
                  .join(",")})
                GROUP BY n.uuid, n.app, n.workspace`,
                      links.map((l) => l.uuid)
                    )
                  )
                  .then(
                    ([results]) =>
                      results as ({ uuid: string; pages: number } & Notebook)[]
                  ),
                cxn.execute(
                  `SELECT field, value FROM quotas where stripe_id is null`
                ),
              ]
            );
            cxn.destroy();
            return {
              minutes: sessions.reduce(
                (p, c) =>
                  differenceInMinutes(c.end_date, c.created_date) / 5 + p,
                0
              ),
              messages: messages.length,
              date: format(endDate, "MMMM do, yyyy"),
              notebooks,
              quotas: Object.fromEntries(
                (quotas as { field: number; value: number }[]).map(
                  (q) => [QUOTAS[q.field], q.value] as const
                )
              ),
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
              .execute(
                `SELECT n.*, m.operation FROM messages m LEFT JOIN notebooks n ON n.uuid = m.source WHERE m.uuid = ?`,
                [messageUuid]
              )
              .then(([args]) => {
                cxn.destroy();
                return args as (Notebook & {
                  uuid: string;
                  operation: string;
                })[];
              });
          }),
        ])
          .then(([Data, [msg]]) => {
            if (!msg) {
              throw new NotFoundError(`No message: ${messageUuid} exists`);
            }
            const { operation, ...source } = msg;
            return {
              data: Data,
              source: {
                uuid: source.uuid || "Unknown",
                app: source.app || 0,
                workspace: source.workspace || "Unknown",
              },
              operation,
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
            await validatePageQuota({ requestId, notebookUuid });

            const pageUuid = v4();
            await cxn.execute(
              `INSERT INTO pages (uuid)
            VALUES (?)`,
              [pageUuid]
            );
            const linkUuid = v4();
            await cxn.execute(
              `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, version, open, invited_by, invited_date, notebook_uuid, cid)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
              [
                linkUuid,
                pageUuid,
                notebookPageId,
                0,
                notebookUuid,
                new Date(),
                notebookUuid,
                "",
              ]
            );
            await saveSharedPage({
              uuid: linkUuid,
              doc: state,
            });
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
        await validatePageQuota({ requestId, notebookUuid });
        await cxn.execute(
          `UPDATE page_notebook_links SET open = 0 WHERE uuid = ?`,
          [uuid]
        );
        const { body: state } = await downloadSharedPage({
          cid: invitedByResults[0].cid,
        });
        await saveSharedPage({ doc: state, uuid });
        await messageNotebook({
          target: invited_by,
          source: notebookUuid,
          operation: "SHARE_PAGE_RESPONSE",
          data: {
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
      case "revert-page-join": {
        const { notebookPageId } = args;
        await cxn.execute(
          `UPDATE page_notebook_links SET open = 1 WHERE notebook_page_id = ? AND notebook_uuid = ? AND open = 0`,
          [notebookUuid, notebookPageId]
        );
        cxn.destroy();
        return {
          success: true,
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
                  operation: "SHARE_PAGE_UPDATE",
                  data: {
                    changes,
                    notebookPageId: notebook_page_id,
                  },
                  requestId,
                })
              )
            );
          });
        const [result] = await cxn.execute(
          `SELECT uuid FROM page_notebook_links WHERE notebook_uuid = ? AND notebook_page_id = ?`,
          [notebookUuid, notebookPageId]
        );
        await saveSharedPage({
          cid,
          doc: state,
          uuid: (result as { uuid: string }[])[0].uuid,
        });

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
        const [results] = await cxn.execute(
          `SELECT uuid FROM page_notebook_links WHERE notebook_uuid = ? AND notebook_page_id = ?`,
          [notebookUuid, notebookPageId]
        );
        const state = await (inputState
          ? saveSharedPage({
              doc: inputState,
              cid,
              uuid: (results as { uuid: string }[])[0].uuid,
            }).then(() => inputState)
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
                operation: "SHARE_PAGE_FORCE",
                data: {
                  state,
                  notebookPageId: notebook_page_id,
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
        const { notebookPageId, target, targetUuid } = args;
        const targetNotebookUuids = target
          ? await getNotebookUuids({
              ...target,
              requestId,
            })
          : targetUuid
          ? [targetUuid]
          : [];
        if (target && targetNotebookUuids.length > 1) {
          throw new ConflictError(
            `Attempted to invite an ambiguous notebook - multiple notebooks within this app have the workspace name: ${target.workspace}`
          );
        } else if (targetNotebookUuids.length === 0) {
          throw new BadRequestError(
            `No live notebooks specified. Inviting new notebooks to SamePage is coming soon!`
          );
        }
        const [targetNotebookUuid] = targetNotebookUuids;
        return Promise.all([
          getSharedPage({
            notebookUuid,
            notebookPageId,
            requestId,
          }),
          getSharedPage({
            notebookUuid: targetNotebookUuid,
            notebookPageId,
            safe: true,
            open: null,
            requestId,
          }),
        ]).then(async ([page, targetPage]) => {
          if (!page) {
            throw new NotFoundError(
              `Attempted to invite a notebook to a page that isn't shared.`
            );
          }
          if (targetPage) {
            throw new MethodNotAllowedError(
              `Attempted to invite a notebook to a page that was already shared with it.`
            );
          }
          const { uuid: pageUuid } = page;
          return inviteNotebookToPage({
            pageUuid,
            targetNotebookUuid,
            notebookPageId,
            requestId,
            notebookUuid,
          })
            .catch(catchError("Failed to invite notebook to a shared page"))
            .finally(() => cxn.destroy());
        });
      }
      case "remove-page-invite": {
        const { notebookPageId, target } = args;
        const { linkUuid, invitedBy } = await (target
          ? cxn
              .execute(
                `SELECT l.uuid 
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
                return { linkUuid: uuid, invitedBy: invited_by };
              }));
        if (!linkUuid) {
          throw new NotFoundError(`Could not find valid invite to remove.`);
        }
        return cxn
          .execute(`DELETE FROM page_notebook_links WHERE uuid = ?`, [linkUuid])
          .then(
            () =>
              invitedBy
                ? messageNotebook({
                    source: notebookUuid,
                    target: invitedBy,
                    data: {
                      title: notebookPageId,
                      rejected: !target,
                      success: false,
                    },
                    operation: "SHARE_PAGE_RESPONSE",
                    requestId,
                  })
                : Promise.resolve() // TODO - send us an email of this error
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
                `SELECT n.app, n.workspace, n.uuid, l.version, l.open FROM page_notebook_links l 
                INNER JOIN notebooks n ON n.uuid = l.notebook_uuid 
                WHERE l.page_uuid = ?`,
                [pageUuid]
              )
              .then(
                ([res]) =>
                  res as (Notebook & {
                    version: number;
                    open: 0 | 1;
                    uuid: string;
                  })[]
              );
            const clientUuids = new Set(clients.map((c) => c.uuid));
            const recents = await cxn
              // TODO - create better hueristics here for recent notebooks, prob its own LRU cache table
              .execute(
                `SELECT n.* FROM notebooks n 
              INNER JOIN token_notebook_links l on l.notebook_uuid = n.uuid`
              )
              .then(([a]) => a as ({ uuid: string } & Notebook)[]);
            cxn.destroy();
            return {
              notebooks: clients.map((c) => ({
                uuid: c.uuid,
                workspace: c.workspace,
                app: appsById[c.app].name,
                version: c.version,
                openInvite: !!c.open,
              })),
              recents: Object.values(
                Object.fromEntries(
                  recents
                    .filter((r) => !clientUuids.has(r.uuid))
                    .map((r) => [r.uuid, r])
                )
              ),
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
        const getTargetsForQuery = () => {
          const [target] = request.split(":");
          return [target];
        };
        const targets = getTargetsForQuery();
        const hash = crypto.createHash("md5").update(request).digest("hex");
        return downloadFileContent({ Key: `data/queries/${hash}.json` })
          .then((r) => {
            if (r)
              return {
                data: JSON.parse(r),
                found: true,
              };
            else return { found: false };
          })
          .then(async (body) =>
            Promise.all(
              targets.map((target) =>
                messageNotebook({
                  source: notebookUuid,
                  target,
                  operation: "QUERY",
                  data: {
                    request,
                  },
                  requestId,
                })
              )
            ).then(() => body)
          )
          .catch(catchError("Failed to query across notebooks"));
      }
      case "query-response": {
        const { request, data, target } = args;
        // TODO replace with IPFS
        const hash = crypto.createHash("md5").update(request).digest("hex");
        await uploadFile({
          Body: JSON.stringify(data),
          Key: `data/queries/${hash}.json`,
        });
        return messageNotebook({
          target,
          source: notebookUuid,
          operation: `QUERY_RESPONSE`,
          data: {
            request,
            data,
          },
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
        const [results] = await cxn.execute(
          `SELECT uuid FROM page_notebook_links WHERE notebook_uuid = ? AND notebook_page_id = ?`,
          [notebookUuid, notebookPageId]
        );
        await saveSharedPage({
          cid,
          doc: state,
          uuid: (results as { uuid: string }[])[0].uuid,
        });
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
      case "get-unmarked-messages": {
        return {
          messages: await cxn
            .execute(
              `SELECT m.uuid, m.operation, n.app, n.workspace, m.metadata FROM messages m
              LEFT JOIN notebooks n ON n.uuid = m.source 
              WHERE m.marked = 0 AND m.target = ?`,
              [notebookUuid]
            )
            .then(([r]) =>
              (
                r as ({
                  uuid: string;
                  operation: Operation;
                  metadata: null | Record<string, string>;
                } & Notebook)[]
              ).map(({ uuid, operation, metadata, ...source }) => {
                return messageToNotification({
                  operation,
                  source,
                  data: metadata || {},
                  uuid,
                });
              })
            ),
        };
      }
      case "mark-message-read": {
        const { messageUuid } = args;
        await cxn.execute(`UPDATE messages SET marked = ? WHERE uuid = ?`, [
          1,
          messageUuid,
        ]);
        cxn.destroy();
        return { success: true };
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
