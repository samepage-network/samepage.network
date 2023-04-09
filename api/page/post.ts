import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import {
  zAuthHeaders,
  zAuthenticatedBody,
  zUnauthenticatedBody,
  zBaseHeaders,
  JSONData,
} from "package/internal/types";
import parseZodError from "package/utils/parseZodError";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServorError,
  MethodNotAllowedError,
  NotFoundError,
  UnauthorizedError,
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
import clerk, { users } from "@clerk/clerk-sdk-node";
import getPrimaryUserEmail from "~/data/getPrimaryUserEmail.server";
import {
  accessTokens,
  apps,
  clientSessions,
  messages,
  notebookRequests,
  notebooks,
  pageNotebookLinks,
  pages,
  quotas,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { z } from "zod";
import debug from "package/utils/debugger";
import getOrGenerateNotebookUuid from "~/data/getOrGenerateNotebookUuid.server";
import getActorInfo from "~/data/getActorInfo.server";

const log = debug("page");
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
        workspace: notebooks.workspace,
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
      const { app, workspace, email, password } = args;
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
      });
      await cxn.end();
      return { notebookUuid, token };
    } else if (args.method === "add-notebook") {
      const { app, workspace, email, password } = args;
      const userResponse = await users.getUserList({ emailAddress: [email] });
      if (userResponse.length === 0) {
        throw new UnauthorizedError(
          `No user found with email ${email}. Please create an account first.`
        );
      }
      if (userResponse.length > 1) {
        throw new ConflictError(
          `Multiple users found with email ${email}. Contact support@samepage.network for help.`
        );
      }
      const userId = userResponse[0].id;
      // https://github.com/clerkinc/javascript/pull/855
      const passwordResponse = await clerk
        .request<{ verified: true }>({
          method: "POST",
          path: `/users/${userId}/verify_password`,
          bodyParams: { userId, password },
        })
        .catch(() => ({ verified: false }));
      if (!passwordResponse.verified) {
        throw new ForbiddenError(`Incorrect password for this email`);
      }
      const [tokenRecord] = await cxn
        .select({ uuid: tokens.uuid, value: tokens.value })
        .from(tokens)
        .where(eq(tokens.userId, userId));
      if (!tokenRecord) {
        throw new InternalServorError(
          `Could not find token to use for this user. Please contact support@samepage.network for help.`
        );
      }
      const notebookUuid = await getOrGenerateNotebookUuid({
        requestId,
        tokenUuid: tokenRecord.uuid,
        app,
        workspace,
      });
      await cxn.end();
      return { notebookUuid, token: tokenRecord.value };
    } else if (args.method === "connect-device") {
      const { email, password } = args;
      const userResponse = await users.getUserList({ emailAddress: [email] });
      if (userResponse.length === 0) {
        throw new UnauthorizedError(
          `No user found with email ${email}. Please create an account first.`
        );
      }
      if (userResponse.length > 1) {
        throw new ConflictError(
          `Multiple users found with email ${email}. Contact support@samepage.network for help.`
        );
      }
      const userId = userResponse[0].id;
      // https://github.com/clerkinc/javascript/pull/855
      const passwordResponse = await clerk
        .request<{ verified: true }>({
          method: "POST",
          path: `/users/${userId}/verify_password`,
          bodyParams: { userId, password },
        })
        .catch(() => ({ verified: false }));
      if (!passwordResponse.verified) {
        throw new ForbiddenError(`Incorrect password for this email`);
      }
      const [tokenResult] = await cxn
        .select({ value: tokens.value, uuid: tokens.uuid })
        .from(tokens)
        .where(eq(tokens.userId, userId));
      if (!tokenResult) {
        throw new InternalServorError(
          `Could not find token to use for this user. Please contact support@samepage.network for help.`
        );
      }
      const { value: token, uuid: tokenUuid } = tokenResult;
      const notebookRecords = await cxn
        .select({
          uuid: notebooks.uuid,
          workspace: notebooks.workspace,
          appName: apps.name,
        })
        .from(tokenNotebookLinks)
        .innerJoin(
          notebooks,
          eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
        )
        .innerJoin(apps, eq(apps.id, notebooks.app))
        .where(eq(tokenNotebookLinks.tokenUuid, tokenUuid));
      await cxn.end();
      return { notebooks: notebookRecords, token, userId };
    } else if (args.method === "login-device") {
      const { token, userId } = args;
      const [tokenResult] = await cxn
        .select({ value: tokens.value, uuid: tokens.uuid })
        .from(tokens)
        .where(eq(tokens.userId, userId));
      if (!tokenResult) {
        throw new InternalServorError(
          `Could not find token to use for this user. Please contact support@samepage.network for help.`
        );
      }
      const { value: storedValue, uuid: tokenUuid } = tokenResult;
      if (storedValue !== token) {
        throw new ForbiddenError(`Incorrect token for this user`);
      }
      const notebookRecords = await cxn
        .select({
          uuid: notebooks.uuid,
          workspace: notebooks.workspace,
          appName: apps.name,
        })
        .from(tokenNotebookLinks)
        .innerJoin(
          notebooks,
          eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
        )
        .innerJoin(apps, eq(apps.id, notebooks.app))
        .where(eq(tokenNotebookLinks.tokenUuid, tokenUuid));
      await cxn.end();
      return { notebooks: notebookRecords, token, userId };
    } else if (args.method === "ping") {
      // uptime checker
      return { success: true };
    }
    const { tokenUuid, notebookUuid } = await authenticateNotebook({
      requestId,
      ...args,
    });

    switch (args.method) {
      case "usage": {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const startDate = new Date(currentYear, currentMonth, 1);

        return getMysql(requestId)
          .then(async (cxn) => {
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
                      eq(clientSessions.notebookUuid, notebookUuid),
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
                quotaRecords.map(
                  (q) => [QUOTAS[q.field || 0], q.value] as const
                )
              ),
            };
          })
          .catch(catchError("Failed to retrieve usage"));
      }
      case "get-actor": {
        const { actorId } = args;
        return getActorInfo({ requestId, actorId });
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
        const { notebookPageId, state } = args;
        const [link] = await cxn
          .select({ page_uuid: pageNotebookLinks.pageUuid })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.notebookUuid, notebookUuid),
              eq(pageNotebookLinks.notebookPageId, notebookPageId)
            )
          );
        if (link) return { id: link.page_uuid, created: false };
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
        await cxn.end();
        return { created: true, id: pageUuid };
      }
      case "join-shared-page": {
        const { notebookPageId } = args;
        const results = await cxn
          .select({
            uuid: pageNotebookLinks.uuid,
            page_uuid: pageNotebookLinks.pageUuid,
            invited_by: pageNotebookLinks.invitedBy,
          })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.notebookPageId, notebookPageId),
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
          .select({ cid: pageNotebookLinks.cid })
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
          .set({ open: 0 })
          .where(eq(pageNotebookLinks.uuid, uuid));
        const [{ cid }] = invitedByResults;
        if (!cid)
          throw new InternalServorError(
            `Could not find cid for page ${page_uuid} invited by ${invited_by}:\n${JSON.stringify(
              invitedByResults
            )}`
          );
        const { body: state } = await downloadSharedPage({
          cid,
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
        const { uuid: pageUuid, cid } = await getSharedPage({
          notebookUuid,
          notebookPageId,
          requestId,
        });
        const [result] = await cxn
          .select({ uuid: pageNotebookLinks.uuid })
          .from(pageNotebookLinks)
          .where(
            and(
              eq(pageNotebookLinks.notebookPageId, notebookPageId),
              eq(pageNotebookLinks.notebookUuid, notebookUuid)
            )
          );
        const state = await (inputState
          ? saveSharedPage({
              doc: inputState,
              cid,
              uuid: result.uuid,
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
        const { target, notebookPageId, seq } = args;
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
        const { notebookPageId, target } = args;
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
                  eq(pageNotebookLinks.notebookPageId, notebookPageId),
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
                  eq(pageNotebookLinks.notebookPageId, notebookPageId),
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
                  eq(pageNotebookLinks.notebookPageId, notebookPageId),
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
        await cxn.end();
        return { notebookPageIds };
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
              cxn
                .delete(pageNotebookLinks)
                .where(
                  and(
                    eq(pageNotebookLinks.notebookUuid, notebookUuid),
                    eq(pageNotebookLinks.notebookPageId, notebookPageId)
                  )
                )
            )
            // TODO: Let errbody know
            .then(() => ({ success: true }))
            .catch(catchError("Failed to disconnect a shared page"))
            .finally(async () => {
              await cxn.end();
            })
        );
      }
      // @deprecated
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
      // @deprecated
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
      case "notebook-request": {
        const { request, targets, label } = args;
        if (!targets.length) {
          return {};
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
              const messageRequest = (uuid: string) =>
                messageNotebook({
                  source: notebookUuid,
                  target,
                  operation: "REQUEST",
                  data: {
                    request,
                    uuid,
                    title: label,
                  },
                  requestId,
                });
              if (!requestRecord) {
                const uuid = v4();
                await cxn.insert(notebookRequests).values({
                  target,
                  notebookUuid,
                  hash,
                  uuid,
                  label,
                  status: hasAccess.length ? "accepted" : "pending",
                });
                await (hasAccess.length
                  ? messageRequest(target)
                  : messageNotebook({
                      source: notebookUuid,
                      target,
                      operation: "REQUEST_DATA",
                      data: {
                        request: JSON.stringify(request, null, 2),
                        uuid,
                        title: label,
                      },
                      requestId,
                      metadata: ["title", "request"],
                    }));
                return [target, null];
              } else if (requestRecord.status === "rejected") {
                return [target, "rejected"];
              } else if (requestRecord.status === "pending") {
                await messageRequest(requestRecord.uuid);
                return [target, "pending"];
              } else {
                const data = await downloadFileContent({
                  Key: `data/requests/${hash}.json`,
                });
                await messageRequest(requestRecord.uuid);
                return [target, JSON.parse(data)];
              }
            } catch (e) {
              return [target, { success: false, error: (e as Error).message }];
            }
          })
        )
          .then(Object.fromEntries)
          .catch(catchError("Failed to request across notebooks"));
      }
      case "notebook-response": {
        const { request, response, target } = args;
        const hash = hashNotebookRequest({ request, target: notebookUuid });
        await uploadFile({
          Body: JSON.stringify(response),
          Key: `data/requests/${hash}.json`,
        });
        return messageNotebook({
          target,
          source: notebookUuid,
          operation: `RESPONSE`,
          data: {
            request,
            response,
          },
          requestId: requestId,
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
  allowedOrigins: [
    "https://roamresearch.com",
    "https://logseq.com",
    "app://obsidian.md",
    /^https:\/\/([\w]+\.)?notion\.so/,
  ],
});
