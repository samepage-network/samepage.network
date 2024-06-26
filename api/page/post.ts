import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import {
  zAuthHeaders,
  zAuthenticatedBody,
  zUnauthenticatedBody,
  zBaseHeaders,
  JSONData,
  zSamePageSchema,
  ListWorkflows,
} from "package/internal/types";
import parseZodError from "package/utils/parseZodError";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
} from "~/data/errors.server";
import catchError from "~/data/catchError.server";
import getMysql from "~/data/mysql.server";
import { eq, and, ne, gt, inArray, isNull } from "drizzle-orm/expressions";
import { sql } from "drizzle-orm/sql";
import { downloadFileContent } from "~/data/downloadFile.server";
import uploadFile from "~/data/uploadFile.server";
import { v4 } from "uuid";
import messageNotebook from "~/data/messageNotebook.server";
import differenceInMinutes from "date-fns/differenceInMinutes";
import crypto from "crypto";
import getSharedPage from "~/data/getSharedPage.server";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import saveSharedPage from "~/data/saveSharedPage.server";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import { Operation } from "package/internal/messages";
import messageToNotification from "package/internal/messageToNotification";
import inviteNotebookToPage from "~/data/inviteNotebookToPage.server";
import createNotebook from "~/data/createNotebook.server";
import QUOTAS from "~/data/quotas.server";
import getQuota from "~/data/getQuota.server";
import { encode } from "@ipld/dag-cbor";
import { users } from "@clerk/clerk-sdk-node";
import getPrimaryUserEmail from "~/data/getPrimaryUserEmail.server";
import {
  accessTokens,
  apps,
  clientSessions,
  messages,
  notebookRequests,
  notebooks,
  pageNotebookLinks,
  pageProperties,
  pages,
  quotas,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { z } from "zod";
import debug from "package/utils/debugger";
import getActorInfo from "~/data/getActorInfo.server";
import listSharedPages from "~/data/listSharedPages.server";
import onboardNotebook from "~/data/onboardNotebook.server";
import { apiPost } from "package/internal/apiClient";
import authenticateUser from "~/data/authenticateUser.server";
import listUserNotebooks from "~/data/listUserNotebooks.server";
import listWorkflows from "~/data/listWorkflows.server";
import getTitleState from "~/data/getTitleState.server";
import postToAppBackend from "package/internal/postToAppBackend";
import { setSetting } from "package/internal/registry";

const log = debug("api:page");
const zhandlerBody = zUnauthenticatedBody.or(
  zAuthenticatedBody.and(zAuthHeaders)
);
const handlerBody = zBaseHeaders.and(zhandlerBody);
export type HandlerBody = z.infer<typeof zhandlerBody>;

const hashNotebookRequest = ({
  target,
  request,
}: {
  target: string;
  request: JSONData;
}) => {
  return crypto
    .createHash("md5")
    .update(target)
    .update(encode(request))
    .digest("hex");
};

const validatePageQuota = async ({
  requestId,
  notebookUuid,
  tokenUuid,
}: {
  requestId: string;
  notebookUuid: string;
  tokenUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const pageQuota = await getQuota({ requestId, field: "Pages", tokenUuid });
  const [{ total }] = await cxn
    .select({
      total: sql<number>`COUNT(${pageNotebookLinks.pageUuid})`,
    })
    .from(pageNotebookLinks)
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, notebookUuid),
        eq(pageNotebookLinks.open, 0)
      )
    );
  if (total >= pageQuota) {
    throw new ConflictError(
      `Maximum number of pages allowed to be connected to this notebook on this plan is ${pageQuota}.`
    );
  }
};

const getRecentNotebooks = async ({
  requestId,
  notebookUuid,
  tokenUuid,
}: {
  requestId: string;
  notebookUuid: string;
  tokenUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const email = await cxn
    .select({ userId: tokens.userId })
    .from(tokens)
    .where(eq(tokens.uuid, tokenUuid))
    .then(([t]) => {
      const userId = t?.userId;
      return userId ? getPrimaryUserEmail(userId) : "";
    })
    .catch(() => "");

  return (
    cxn
      .select({
        uuid: notebooks.uuid,
        workspace: notebooks.label,
        appName: apps.name,
      })
      .from(notebooks)
      .innerJoin(
        tokenNotebookLinks,
        eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
      )
      .innerJoin(apps, eq(apps.id, notebooks.app))
      .where(
        and(
          eq(tokenNotebookLinks.tokenUuid, tokenUuid),
          ne(notebooks.uuid, notebookUuid)
        )
      )
      // TODO - create better hueristics here for recent notebooks, prob its own LRU cache table
      // OR we create a contacts table and load those notebooks here
      .then((recents) =>
        Object.values(
          Object.fromEntries(
            recents.map((r) => [
              r.uuid,
              {
                uuid: r.uuid,
                workspace: r.workspace,
                appName: r.appName,
                email,
              },
            ])
          )
        )
      )
  );
};

const logic = async (req: Record<string, unknown>) => {
  const result = handlerBody.safeParse(req);
  if (!result.success)
    throw new BadRequestError(
      `Failed to parse request. Errors:\n${parseZodError(result.error)}`
    );
  const { requestId, ...args } = result.data;
  const cxn = await getMysql(requestId);
  log("received method", args.method);
  try {
    if (args.method === "create-notebook") {
      const { app, workspace, email, password, label } = args;
      const userId = await users
        .createUser({ emailAddress: [email], password })
        .then((u) => u.id)
        .catch((e) => {
          if (e.errors) {
            const msg = e.errors
              .map(
                (a: { message: string; longMessage: string }) =>
                  a.longMessage || a.message
              )
              .join("\n");
            throw new BadRequestError(msg || JSON.stringify(e));
          }
          throw e;
        });
      const { token, notebookUuid } = await createNotebook({
        requestId,
        app,
        workspace,
        userId,
        label,
      });
      await cxn.end();
      return { notebookUuid, token };
    } else if (args.method === "add-notebook") {
      const response = await onboardNotebook({ requestId, ...args });
      await cxn.end();
      return response;
    } else if (args.method === "authenticate-user") {
      return authenticateUser({ requestId, ...args });
    } else if (args.method === "list-user-notebooks") {
      return listUserNotebooks({ requestId, ...args });
    } else if (args.method === "ping") {
      // uptime checker
      return { success: true };
    }
    const authenticatedNotebook = await authenticateNotebook({
      requestId,
      ...args,
    });
    const {
      tokenUuid,
      notebookUuid,
      app: appName,
      appCode,
      workspaceName,
      userId,
      actorId,
    } = authenticatedNotebook;

    switch (args.method) {
      case "get-app-code": {
        await cxn.end();
        return { appCode };
      }
      case "authenticate-notebook": {
        await cxn.end();
        return authenticatedNotebook;
      }
      case "usage": {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const startDate = new Date(currentYear, currentMonth, 1);

        const [sessions, messageRecords, notebookRecords, quotaRecords] =
          await Promise.all([
            cxn
              .select({
                id: clientSessions.id,
                created_date: clientSessions.createdDate,
                end_date: clientSessions.endDate,
              })
              .from(clientSessions)
              .where(
                and(
                  eq(clientSessions.actorUuid, actorId),
                  gt(clientSessions.createdDate, startDate)
                )
              ),
            cxn
              .select({ uuid: messages.uuid })
              .from(messages)
              .where(
                and(
                  eq(messages.source, notebookUuid),
                  gt(messages.createdDate, startDate)
                )
              ),
            cxn
              .select({ uuid: tokenNotebookLinks.uuid })
              .from(tokenNotebookLinks)
              .where(eq(tokenNotebookLinks.notebookUuid, notebookUuid))
              .then((links) =>
                cxn
                  .select({
                    uuid: notebooks.uuid,
                    app: notebooks.app,
                    appName: apps.name,
                    workspace: notebooks.workspace,
                    pages: sql<number>`COUNT(${pageNotebookLinks.uuid})`,
                  })
                  .from(pageNotebookLinks)
                  .innerJoin(
                    notebooks,
                    eq(pageNotebookLinks.notebookUuid, notebooks.uuid)
                  )
                  .innerJoin(
                    tokenNotebookLinks,
                    eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
                  )
                  .innerJoin(apps, eq(apps.id, notebooks.app))
                  .where(
                    and(
                      eq(pageNotebookLinks.open, 0),
                      inArray(
                        tokenNotebookLinks.uuid,
                        links.map((l) => l.uuid)
                      )
                    )
                  )
              ),
            cxn
              .select({ field: quotas.field, value: quotas.value })
              .from(quotas)
              .where(isNull(quotas.stripeId)),
          ]);
        await cxn.end();
        return {
          minutes: sessions.reduce(
            (p, c) => differenceInMinutes(c.end_date, c.created_date) + p,
            0
          ),
          messages: messageRecords.length,
          notebooks: notebookRecords,
          quotas: Object.fromEntries(
            quotaRecords.map((q) => [QUOTAS[q.field || 0], q.value] as const)
          ),
        };
      }
      case "get-actor": {
        const { actorId: inputActorId } = args;
        const info = !inputActorId
          ? {
              email: userId,
              notebookUuid,
              appName,
              workspace: workspaceName,
              actorId,
            }
          : await getActorInfo({ requestId, actorId: inputActorId });
        await cxn.end();
        return info;
      }
      case "load-message": {
        const { messageUuid } = args;
        return Promise.all([
          downloadFileContent({
            Key: `data/messages/${messageUuid}.json`,
          }).then((r) => r || "{}"),
          getMysql(requestId).then((cxn) => {
            return cxn
              .select({
                uuid: notebooks.uuid,
                app: notebooks.app,
                workspace: notebooks.workspace,
                appName: apps.name,
                operation: messages.operation,
              })
              .from(messages)
              .leftJoin(notebooks, eq(notebooks.uuid, messages.source))
              .leftJoin(apps, eq(apps.id, notebooks.app))
              .where(eq(messages.uuid, messageUuid))
              .then((args) => cxn.end().then(() => args));
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
                appName: source.appName || "SamePage",
              },
              operation,
            };
          })
          .catch(catchError("Failed to load a message"));
      }
      case "init-shared-page": {
        const { notebookPageId, state, properties } = args;
        const [link] = await cxn
          .select({
            page_uuid: pageNotebookLinks.pageUuid,
            linkUuid: pageNotebookLinks.uuid,
          })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.notebookPageId, notebookPageId)
            )
          );
        if (link)
          return {
            id: link.page_uuid,
            created: false,
            linkUuid: link.linkUuid,
          };
        await validatePageQuota({ requestId, notebookUuid, tokenUuid });

        const pageUuid = v4();
        await cxn.insert(pages).values({ uuid: pageUuid });
        const linkUuid = v4();
        await cxn.insert(pageNotebookLinks).values({
          uuid: linkUuid,
          pageUuid,
          notebookPageId,
          version: 0,
          open: 0,
          invitedBy: notebookUuid,
          invitedDate: new Date(),
          notebookUuid,
          cid: "",
        });
        await saveSharedPage({
          uuid: linkUuid,
          doc: state,
        });
        if (properties && Object.keys(properties).length) {
          await cxn.insert(pageProperties).values(
            ...Object.entries(properties).map(([key, value]) => ({
              uuid: v4(),
              linkUuid,
              key,
              value,
            }))
          );
        }
        await cxn.end();
        return { created: true, id: pageUuid, linkUuid };
      }
      case "join-shared-page": {
        const { notebookPageId, pageUuid, title } = args;
        const results = await cxn
          .select({
            uuid: pageNotebookLinks.uuid,
            page_uuid: pageNotebookLinks.pageUuid,
            invited_by: pageNotebookLinks.invitedBy,
          })
          .from(pageNotebookLinks)
          .where(
            and(
              pageUuid
                ? eq(pageNotebookLinks.pageUuid, pageUuid)
                : eq(pageNotebookLinks.notebookPageId, notebookPageId),
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.open, 1)
            )
          );
        if (!results.length) {
          await cxn.end();
          return {
            found: false,
            reason: "Failed to find invite",
          };
        }
        const { uuid, page_uuid, invited_by } = results[0];
        const invitedByResults = await cxn
          .select({
            cid: pageNotebookLinks.cid,
            linkUuid: pageNotebookLinks.uuid,
          })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.pageUuid, page_uuid),
              eq(pageNotebookLinks.open, 0),
              eq(pageNotebookLinks.notebookUuid, invited_by)
            )
          );
        if (!invitedByResults.length) {
          await cxn.end();
          return {
            found: false,
            reason: "Invited by notebook no longer connected to page",
          };
        }
        await validatePageQuota({ requestId, notebookUuid, tokenUuid });
        await cxn
          .update(pageNotebookLinks)
          .set({ open: 0, notebookPageId })
          .where(eq(pageNotebookLinks.uuid, uuid));
        const [{ cid, linkUuid }] = invitedByResults;
        if (!cid)
          throw new InternalServerError(
            `Could not find cid for page ${page_uuid} invited by ${invited_by}:\n${JSON.stringify(
              invitedByResults
            )}`
          );
        const { body: state } = await downloadSharedPage({
          cid,
        });
        await saveSharedPage({ doc: state, uuid });
        const invitedByPageProperties = await cxn
          .select({ key: pageProperties.key, value: pageProperties.value })
          .from(pageProperties)
          .where(eq(pageProperties.linkUuid, linkUuid));
        if (invitedByPageProperties.length)
          await cxn.insert(pageProperties).values(
            ...invitedByPageProperties.map((prop) => ({
              ...(prop.key === "$title"
                ? { key: "$title", value: title }
                : prop),
              linkUuid: uuid,
              uuid: v4(),
            }))
          );
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
        await cxn.end();
        const b64State = Buffer.from(state).toString("base64");
        return {
          state: b64State,
          found: true,
        };
      }
      case "revert-page-join": {
        const { notebookPageId } = args;
        await cxn
          .update(pageNotebookLinks)
          .set({ open: 1 })
          .where(
            and(
              eq(pageNotebookLinks.notebookPageId, notebookPageId),
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.open, 0)
            )
          );
        await cxn.end();
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
          await cxn.end();
          return { success: false };
        }
        await cxn
          .select({
            notebook_uuid: pageNotebookLinks.notebookUuid,
            notebook_page_id: pageNotebookLinks.notebookPageId,
          })
          .from(pageNotebookLinks)
          .where(eq(pageNotebookLinks.pageUuid, pageUuid))
          .then((r) => {
            const clients = r.filter((item) => {
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
        const [result] = await cxn
          .select({ uuid: pageNotebookLinks.uuid })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.notebookPageId, notebookPageId)
            )
          );
        await saveSharedPage({
          cid,
          doc: state,
          uuid: result.uuid,
        });

        await cxn.end();
        return {
          success: true,
        };
      }
      case "force-push-page": {
        const { notebookPageId, state: inputState } = args;
        const {
          uuid: pageUuid,
          cid,
          linkUuid,
        } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        const state = await (inputState
          ? saveSharedPage({
              doc: inputState,
              cid,
              uuid: linkUuid,
            }).then(() => inputState)
          : downloadSharedPage({ cid }).then((b) =>
              Buffer.from(b.body).toString("base64")
            ));
        const notebooks = await cxn
          .select({
            notebook_page_id: pageNotebookLinks.notebookPageId,
            notebook_uuid: pageNotebookLinks.notebookUuid,
          })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.pageUuid, pageUuid),
              eq(pageNotebookLinks.open, 0)
            )
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
        await cxn.end();

        return {
          success: true,
        };
      }
      case "request-page-update": {
        const { target: _target, notebookPageId, seq = 0, actor = "" } = args;
        if (!_target && !actor)
          throw new BadRequestError("Must include actor to request");
        const target =
          // @deprecated - use actor instead
          _target ||
          (await cxn
            .select({ notebookUuid: tokenNotebookLinks.notebookUuid })
            .from(tokenNotebookLinks)
            .where(eq(tokenNotebookLinks.uuid, actor))
            .then(([{ notebookUuid }]) => notebookUuid));
        if (!target)
          throw new BadRequestError("Must include a valid actor to request");
        await messageNotebook({
          source: notebookUuid,
          operation: "REQUEST_PAGE_UPDATE",
          target,
          data: { notebookPageId, seq },
          requestId,
        });
        return { success: true };
      }
      case "page-update-response": {
        const { target, notebookPageId, dependencies, changes } = args;
        await messageNotebook({
          source: notebookUuid,
          operation: "SHARE_PAGE_UPDATE",
          target,
          data: { notebookPageId, dependencies, changes },
          requestId,
        });
        return { success: true };
      }
      case "invite-notebook-to-page": {
        const { notebookPageId, targetEmail, targetUuid } = args;
        const targetNotebookUuid =
          targetUuid ||
          (targetEmail
            ? await users
                .getUserList({ emailAddress: [targetEmail] })
                .then((us) =>
                  us.length
                    ? cxn
                        .select({ uuid: notebooks.uuid })
                        .from(notebooks)
                        .innerJoin(
                          tokenNotebookLinks,
                          eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
                        )
                        .innerJoin(
                          tokens,
                          eq(tokens.uuid, tokenNotebookLinks.tokenUuid)
                        )
                        .where(eq(tokens.userId, us[0].id))
                        .limit(1)
                        .then(([records]) => records?.uuid)
                    : ""
                )
            : "");
        if (!targetNotebookUuid) {
          throw new BadRequestError(
            `No live notebooks specified. Inviting new notebooks to SamePage is coming soon!`
          );
        }
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
            .finally(async () => {
              await cxn.end();
            });
        });
      }
      case "remove-page-invite": {
        const { notebookPageId = "", target, pageUuid = "" } = args;
        const inviteCondition = pageUuid
          ? eq(pageNotebookLinks.pageUuid, pageUuid)
          : eq(pageNotebookLinks.notebookPageId, notebookPageId);
        const { linkUuid, invitedBy } = await (typeof target === "string"
          ? cxn
              .select({ uuid: pageNotebookLinks.uuid })
              .from(pageNotebookLinks)
              .innerJoin(
                notebooks,
                eq(notebooks.uuid, pageNotebookLinks.notebookUuid)
              )
              .where(
                and(
                  eq(notebooks.uuid, target),
                  inviteCondition,
                  eq(pageNotebookLinks.open, 1),
                  eq(pageNotebookLinks.invitedBy, notebookUuid)
                )
              )
              .then(([invitedByLink]) => ({
                invitedBy: notebookUuid,
                linkUuid: invitedByLink?.uuid,
              }))
          : typeof target === "object"
          ? cxn
              .select({ uuid: pageNotebookLinks.uuid })
              .from(pageNotebookLinks)
              .innerJoin(
                notebooks,
                eq(notebooks.uuid, pageNotebookLinks.notebookUuid)
              )
              .where(
                and(
                  eq(notebooks.workspace, target.workspace),
                  eq(notebooks.app, target.app),
                  inviteCondition,
                  eq(pageNotebookLinks.open, 1),
                  eq(pageNotebookLinks.invitedBy, notebookUuid)
                )
              )
              .then(([invitedByLink]) => ({
                invitedBy: notebookUuid,
                linkUuid: invitedByLink?.uuid,
              }))
          : cxn
              .select({
                uuid: pageNotebookLinks.uuid,
                invitedBy: pageNotebookLinks.invitedBy,
              })
              .from(pageNotebookLinks)
              .where(
                and(
                  eq(pageNotebookLinks.notebookUuid, notebookUuid),
                  inviteCondition,
                  eq(pageNotebookLinks.open, 1)
                )
              )
              .then(async ([link]) => {
                return { linkUuid: link?.uuid, invitedBy: link?.invitedBy };
              }));
        if (!linkUuid) {
          throw new NotFoundError(`Could not find valid invite to remove.`);
        }
        return cxn
          .delete(pageNotebookLinks)
          .where(eq(pageNotebookLinks.uuid, linkUuid))
          .then(() =>
            messageNotebook({
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
          )
          .then(() => ({ success: true }))
          .catch(catchError("Failed to remove a shared page"))
          .finally(async () => {
            await cxn.end();
          });
      }
      case "list-page-notebooks": {
        const { notebookPageId } = args;

        const { uuid: pageUuid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        const clients = await cxn
          .select({
            appName: apps.name,
            workspace: notebooks.workspace,
            uuid: notebooks.uuid,
            version: pageNotebookLinks.version,
            open: pageNotebookLinks.open,
            user: tokens.userId,
            priority: sql<number>`CASE 
            WHEN ${pageNotebookLinks.notebookUuid} = ${pageNotebookLinks.invitedBy} THEN 1
            ELSE 2 
          END`.as("priority"),
          })
          .from(pageNotebookLinks)
          .innerJoin(
            notebooks,
            eq(notebooks.uuid, pageNotebookLinks.notebookUuid)
          )
          .innerJoin(
            tokenNotebookLinks,
            eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
          )
          .innerJoin(tokens, eq(tokens.uuid, tokenNotebookLinks.tokenUuid))
          .innerJoin(apps, eq(apps.id, notebooks.app))
          .where(eq(pageNotebookLinks.pageUuid, pageUuid))
          .orderBy(sql`priority`, pageNotebookLinks.invitedDate);
        const clientUuids = new Set(clients.map((c) => c.uuid));
        const recents = await getRecentNotebooks({
          requestId,
          notebookUuid,
          tokenUuid,
        });
        await cxn.end();
        const emailsByIds = await users
          .getUserList({ userId: clients.map((u) => u.user) })
          .then((us) =>
            Object.fromEntries(
              us.map((u) => [
                u.id,
                u.emailAddresses.find((ea) => ea.id === u.primaryEmailAddressId)
                  ?.emailAddress,
              ])
            )
          );
        return {
          notebooks: clients.map((c) => ({
            uuid: c.uuid,
            workspace: c.workspace,
            app: c.appName,
            version: c.version,
            openInvite: !!c.open,
            email: emailsByIds[c.user],
          })),
          recents: recents.filter((r) => !clientUuids.has(r.uuid)),
        };
      }
      case "list-recent-notebooks": {
        const notebooks = await getRecentNotebooks({
          requestId,
          notebookUuid,
          tokenUuid,
        });
        await cxn.end();
        return {
          notebooks,
        };
      }
      case "list-shared-pages": {
        // @DEPRECATED - listSharedPages used instead below
        const notebookPageIds = await cxn
          .select({ notebookPageId: pageNotebookLinks.notebookPageId })
          .from(pageNotebookLinks)
          .innerJoin(pages, eq(pages.uuid, pageNotebookLinks.pageUuid))
          .where(
            and(
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.open, 0)
            )
          )
          .then((r) => r.map(({ notebookPageId }) => notebookPageId));
        const sharedPages = await listSharedPages({
          requestId,
          notebookUuid,
        });
        await cxn.end();
        return { notebookPageIds, ...sharedPages };
      }
      case "list-workflows": {
        const sharedWorkflows = await listWorkflows({
          requestId,
          notebookUuid,
        });
        setSetting("uuid", notebookUuid);
        setSetting("token", args.token);
        const privateWorkflows = await (postToAppBackend({
          app: appCode,
          data: {
            type: "LIST_WORKFLOWS",
          },
        }) as ReturnType<ListWorkflows>);
        await cxn.end();
        return {
          workflows: [
            ...sharedWorkflows.workflows,
            ...privateWorkflows.workflows,
          ],
        };
      }
      case "get-workflow": {
        const { workflowUuid } = args;
        const [page] = await cxn
          .select({
            notebookPageId: pageNotebookLinks.notebookPageId,
          })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.uuid, workflowUuid),
              eq(pageNotebookLinks.notebookUuid, notebookUuid)
            )
          );
        if (!page) {
          await cxn.end();
          throw new NotFoundError(`No page found for uuid "${workflowUuid}"`);
        }
        const { notebookPageId } = page;
        const title = await getTitleState({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        const destinations = await cxn
          .select({
            notebookUuid: notebooks.uuid,
            appName: apps.name,
            workspaceName: notebooks.label,
          })
          .from(notebooks)
          .innerJoin(
            tokenNotebookLinks,
            eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
          )
          .innerJoin(apps, eq(apps.id, notebooks.app))
          .where(eq(tokenNotebookLinks.tokenUuid, tokenUuid));
        await cxn.end();
        console.log("destinations", destinations, "title", title);
        return { title, destinations };
      }
      case "list-overlays": {
        // TODO
        return { overlays: [] };
      }
      case "list-requests": {
        // TODO
        return { requests: [] };
      }
      case "disconnect-shared-page": {
        const { notebookPageId } = args;
        const { linkUuid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        await cxn
          .delete(pageProperties)
          .where(eq(pageProperties.linkUuid, linkUuid));
        await cxn
          .delete(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.notebookPageId, notebookPageId)
            )
          );
        await cxn.end();
        return { success: true };
      }
      // @deprecated - use notebook-request instead
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
      // @deprecated - use notebook-response instead
      case "query-response": {
        const { request, data, target } = args;
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
      case "notebook-request": {
        const { request, targets: _targets, target, label } = args;
        const targets = target ? [target] : _targets || [];
        if (!targets.length) {
          throw new NotFoundError("No targets specified");
        }
        return Promise.all(
          targets.map(async (target) => {
            try {
              const hash = hashNotebookRequest({ request, target });
              const [requestRecord] = await cxn
                .select({
                  status: notebookRequests.status,
                  uuid: notebookRequests.uuid,
                })
                .from(notebookRequests)
                .where(
                  and(
                    eq(notebookRequests.hash, hash),
                    eq(notebookRequests.notebookUuid, notebookUuid)
                  )
                );
              const messageRequest = (requestUuid: string) =>
                messageNotebook({
                  source: notebookUuid,
                  target,
                  operation: "REQUEST",
                  data: {
                    request,
                    requestUuid,
                    title: label,
                  },
                  requestId,
                });
              if (!requestRecord) {
                const hasAccess = await cxn
                  .select({
                    uuid: tokenNotebookLinks.uuid,
                  })
                  .from(tokenNotebookLinks)
                  .where(
                    and(
                      eq(tokenNotebookLinks.notebookUuid, target),
                      eq(tokenNotebookLinks.tokenUuid, tokenUuid)
                    )
                  );
                const uuid = v4();
                await cxn.insert(notebookRequests).values({
                  target,
                  notebookUuid,
                  hash,
                  uuid,
                  label,
                  status: hasAccess.length ? "accepted" : "pending",
                });
                const messageUuid = await (hasAccess.length
                  ? messageRequest(uuid)
                  : messageNotebook({
                      source: notebookUuid,
                      target,
                      operation: "REQUEST_DATA",
                      data: {
                        request: JSON.stringify(request, null, 2),
                        requestUuid: uuid,
                        title: label,
                      },
                      requestId,
                      saveData: true,
                    }));
                return {
                  target,
                  response: null,
                  requestUuid: uuid,
                  messageUuid,
                  cacheHit: false,
                };
              } else if (requestRecord.status === "rejected") {
                return {
                  target,
                  response: "rejected",
                  requestUuid: requestRecord.uuid,
                  cacheHit: false,
                };
              } else if (requestRecord.status === "pending") {
                const messageUuid = await messageRequest(requestRecord.uuid);
                return {
                  target,
                  response: "pending",
                  requestUuid: requestRecord.uuid,
                  cacheHit: false,
                  messageUuid,
                };
              } else {
                const data = await downloadFileContent({
                  Key: `data/requests/${hash}.json`,
                });
                const messageUuid = await messageRequest(requestRecord.uuid);
                return {
                  target,
                  response: data ? JSON.parse(data) : {},
                  requestUuid: requestRecord.uuid,
                  cacheHit: true,
                  messageUuid,
                };
              }
            } catch (e) {
              console.error("Failed to request target", target, e);
              return {
                target,
                response: { success: false, error: (e as Error).message },
                requestUuid: "",
                cacheHit: false,
              };
            }
          })
        )
          .then(async (resps) => {
            await cxn.end();
            const responses = resps.filter((r) => !!r.requestUuid);
            if (responses.length > 1) {
              return Object.fromEntries(
                responses.map(({ target, response }) => [target, response])
              );
            } else if (responses.length === 1) {
              return {
                response: responses[0].response,
                requestUuid: responses[0].requestUuid,
                cacheHit: responses[0].cacheHit,
                messageUuid: responses[0].messageUuid,
              };
            } else {
              throw new Error(resps[0].response.error);
            }
          })
          .catch(catchError("Failed to request across notebooks"));
      }
      case "notebook-response": {
        const { requestUuid, response, target, messageUuid } = args;

        const [notebookRequest] = await cxn
          .select({
            hash: notebookRequests.hash,
          })
          .from(notebookRequests)
          .where(eq(notebookRequests.uuid, requestUuid));
        if (!notebookRequest)
          throw new NotFoundError(`Couldn't find request ${requestUuid}`);
        const { hash } = notebookRequest;
        await uploadFile({
          Body: JSON.stringify(response),
          Key: `data/requests/${hash}.json`,
        });
        // TODO: seems redundant to do this here and in the response handler
        await uploadFile({
          Body: JSON.stringify(response),
          Key: `data/responses/${messageUuid}.json`,
        });
        return messageNotebook({
          target,
          source: notebookUuid,
          operation: `RESPONSE`,
          data: {
            requestUuid,
            response,
            messageUuid,
          },
          requestId,
        })
          .then(() => ({ success: true }))
          .catch(catchError("Failed to respond to request"));
      }
      case "accept-request": {
        const { requestUuid } = args;
        const [request] = await cxn
          .select({ target: notebookRequests.target })
          .from(notebookRequests)
          .where(eq(notebookRequests.uuid, requestUuid));
        if (!request) {
          throw new NotFoundError(`Couldn't find request: ${requestUuid}`);
        }
        if (request.target !== notebookUuid) {
          throw new ForbiddenError(
            `Request ${requestUuid} is not for this notebook`
          );
        }
        await cxn
          .update(notebookRequests)
          .set({ status: "accepted" })
          .where(eq(notebookRequests.uuid, requestUuid));
        return { success: true };
      }
      case "reject-request": {
        const { requestUuid } = args;
        const [request] = await cxn
          .select({ target: notebookRequests.target })
          .from(notebookRequests)
          .where(eq(notebookRequests.uuid, requestUuid));
        if (!request) {
          throw new NotFoundError(`Couldn't find request: ${requestUuid}`);
        }
        if (request.target !== notebookUuid) {
          throw new ForbiddenError(
            `Request ${requestUuid} is not for this notebook`
          );
        }
        await cxn
          .update(notebookRequests)
          .set({ status: "rejected" })
          .where(eq(notebookRequests.uuid, requestUuid));
        return { success: true };
      }
      case "link-different-page": {
        const { oldNotebookPageId, newNotebookPageId } = args;
        const [result] = await cxn
          .select({ uuid: pageNotebookLinks.uuid })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.notebookPageId, oldNotebookPageId)
            )
          );
        if (!result) {
          throw new NotFoundError(
            `Couldn't find old notebook page id: ${oldNotebookPageId}`
          );
        }
        await cxn
          .update(pageNotebookLinks)
          .set({ notebookPageId: newNotebookPageId })
          .where(eq(pageNotebookLinks.uuid, result.uuid));
        await cxn.end();
        return { success: true };
      }
      case "save-page-version": {
        const { state, notebookPageId } = args;
        const { cid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        const [result] = await cxn
          .select({ uuid: pageNotebookLinks.uuid })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.notebookPageId, notebookPageId)
            )
          );
        await saveSharedPage({
          cid,
          doc: state,
          uuid: result.uuid,
        });
        await cxn.end();
        return { success: true };
      }
      case "restore-page-version": {
        // This method is very similar for force-push-page for now...
        const { notebookPageId, state } = args;
        const {
          uuid: pageUuid,
          cid,
          linkUuid,
        } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        await saveSharedPage({
          doc: state,
          cid,
          uuid: linkUuid,
          force: true,
        });
        const notebooks = await cxn
          .select({
            notebook_page_id: pageNotebookLinks.notebookPageId,
            notebook_uuid: pageNotebookLinks.notebookUuid,
          })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.pageUuid, pageUuid),
              eq(pageNotebookLinks.open, 0)
            )
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
        await cxn.end();

        return {
          success: true,
        };
      }
      case "get-ipfs-cid": {
        const { notebookPageId } = args;
        const { cid, linkUuid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        await cxn.end();
        return { cid, uuid: linkUuid };
      }
      case "create-public-link": {
        const { notebookPageId } = args;
        const { linkUuid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        await cxn
          .update(pageNotebookLinks)
          .set({ isPublic: true })
          .where(eq(pageNotebookLinks.uuid, linkUuid));
        await cxn.end();
        return { uuid: linkUuid };
      }
      case "head-shared-page": {
        const { linkUuid } = args;
        const [page] = await cxn
          .select({
            notebookPageId: pageNotebookLinks.notebookPageId,
            title: pageProperties.value,
          })
          .from(pageNotebookLinks)
          .innerJoin(
            pageProperties,
            eq(pageProperties.linkUuid, pageNotebookLinks.uuid)
          )
          .where(
            and(
              eq(pageNotebookLinks.uuid, linkUuid),
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.open, 0),
              eq(pageProperties.key, "$title")
            )
          );
        await cxn.end();
        if (!page) {
          throw new NotFoundError(
            `User is authenticated, but does not have access to page ${linkUuid}`
          );
        }
        return {
          notebookPageId: page.notebookPageId,
          title: zSamePageSchema.parse(page.title),
        };
      }
      case "get-shared-page": {
        const { notebookPageId } = args;
        const { cid } = await getSharedPage({
          notebookUuid,
          requestId,
          notebookPageId,
        });
        const { body: state } = await downloadSharedPage({ cid });
        await cxn.end();
        return { state: Buffer.from(state).toString("base64") };
      }
      case "is-page-shared": {
        const { notebookPageId } = args;
        const record = await getSharedPage({
          notebookUuid,
          requestId,
          notebookPageId,
          safe: true,
        });
        await cxn.end();
        return { exists: !!record };
      }
      case "get-unmarked-messages": {
        return {
          messages: await cxn
            .select({
              messageUuid: messages.uuid,
              operation: messages.operation,
              metadata: messages.metadata,
              app: notebooks.app,
              workspace: notebooks.workspace,
              uuid: notebooks.uuid,
              appName: apps.name,
            })
            .from(messages)
            .leftJoin(notebooks, eq(messages.source, notebooks.uuid))
            .leftJoin(apps, eq(notebooks.app, apps.id))
            .where(
              and(eq(messages.target, notebookUuid), eq(messages.marked, 0))
            )
            .then(async (r) => {
              await cxn.end();
              return r.map(
                ({ messageUuid, operation, metadata, ...source }) => {
                  return messageToNotification({
                    operation: operation as Operation,
                    source,
                    data: (metadata || {}) as Record<string, string>,
                    uuid: messageUuid,
                  });
                }
              );
            }),
        };
      }
      case "mark-message-read": {
        const { messageUuid } = args;
        await cxn
          .update(messages)
          .set({ marked: 1 })
          .where(eq(messages.uuid, messageUuid));
        await cxn.end();
        return { success: true };
      }
      case "save-access-token": {
        const { accessToken } = args;
        // console.log("accessToken", accessToken);
        const userId = await cxn
          .select({ id: tokens.userId })
          .from(tokens)
          .where(eq(tokens.uuid, tokenUuid))
          .then((r) => r[0]?.id);
        await cxn
          .insert(accessTokens)
          .values({
            uuid: v4(),
            notebookUuid,
            value: accessToken,
            userId,
          })
          .onDuplicateKeyUpdate({ set: { value: accessToken } });
        await cxn.end();
        return { success: true };
      }
      case "import-shared-page": {
        const { cid } = args;
        const results = await cxn
          .select({ uuid: pageNotebookLinks.uuid })
          .from(pageNotebookLinks)
          .innerJoin(
            tokenNotebookLinks,
            eq(tokenNotebookLinks.notebookUuid, pageNotebookLinks.notebookUuid)
          )
          .where(
            and(
              eq(pageNotebookLinks.cid, cid),
              eq(tokenNotebookLinks.tokenUuid, tokenUuid)
            )
          );
        if (!results.length) {
          throw new NotFoundError(`No shared page found for cid: ${cid}`);
        }
        const { body: state } = await downloadSharedPage({ cid });
        await cxn.end();
        return { state: Buffer.from(state).toString("base64") };
      }
      case "call-workflow-command": {
        const {
          commandContext,
          args: commandArgs,
          text,
          workflowContext,
        } = args;
        const [targetNotebook] = await cxn
          .select({
            uuid: notebooks.uuid,
            path: apps.code,
            accessToken: accessTokens.value,
          })
          .from(notebooks)
          .innerJoin(apps, eq(notebooks.app, apps.id))
          .innerJoin(
            tokenNotebookLinks,
            eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
          )
          .innerJoin(
            accessTokens,
            eq(notebooks.uuid, accessTokens.notebookUuid)
          )
          .where(
            and(
              eq(apps.code, commandContext),
              eq(tokenNotebookLinks.tokenUuid, tokenUuid)
            )
          );
        await cxn.end();
        return await apiPost({
          path: `extensions/${targetNotebook.path}/backend`,
          data: {
            type: "COMMAND_HANDLER",
            notebookUuid: targetNotebook.uuid,
            args: commandArgs,
            text,
            workflowContext,
          },
          authorization: `Basic ${Buffer.from(
            `${notebookUuid}:${args.token}`
          ).toString("base64")}`,
        });
      }
      default: {
        throw new Error(`Unknown method: ${args["method"]}`);
      }
    }
  } catch (e) {
    await cxn.end();
    return catchError(`Failed to process method: ${args.method}`)(e as Error);
  }
  // Why does this not work?
  // finally {
  //   await cxn.end();
  // }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/.+/],
});
