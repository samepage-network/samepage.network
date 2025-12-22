import { NotFoundError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import getPrimaryUserEmail from "./getPrimaryUserEmail.server";
import {
  apps,
  messages,
  notebooks,
  pageNotebookLinks,
  pageProperties,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { eq, desc, and } from "drizzle-orm";
import { sql } from "drizzle-orm/sql";
import { zSamePageSchema } from "package/internal/types";

const getAdminNotebookProfile = async ({
  context: { requestId },
  params: { uuid = "" },
}: {
  params: Record<string, string | undefined>;
  context: { requestId: string };
}) => {
  const cxn = await getMysql(requestId);
  const [notebook] = await cxn
    .select({
      app: apps.name,
      workspace: notebooks.workspace,
      uuid: notebooks.uuid,
      token: tokens.value,
      createdDate: tokens.createdDate,
      userId: tokens.userId,
    })
    .from(notebooks)
    .leftJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .leftJoin(tokens, eq(tokenNotebookLinks.tokenUuid, tokens.uuid))
    .innerJoin(apps, eq(notebooks.app, apps.id))
    .where(eq(notebooks.uuid, uuid));
  if (!notebook)
    throw new NotFoundError(`Could not find notebook by uuid: ${uuid}`);
  const pages = await cxn
    .select({
      uuid: pageNotebookLinks.uuid,
      title: pageProperties.value,
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .leftJoin(
      pageProperties,
      and(
        eq(pageNotebookLinks.uuid, pageProperties.linkUuid),
        eq(pageProperties.key, "$title")
      )
    )
    .where(eq(pageNotebookLinks.notebookUuid, uuid))
    .orderBy(desc(pageNotebookLinks.invitedDate))
    .limit(10)
    .then((res) =>
      res.map((r) => {
        const titleData = zSamePageSchema.safeParse(r.title);

        return {
          uuid: r.uuid,
          title: titleData.success ? titleData.data.content : r.notebookPageId,
        };
      })
    );
  const [{ count: pageCount }] = await cxn
    .select({
      count: sql`COUNT(${pageNotebookLinks.uuid})`,
    })
    .from(pageNotebookLinks)
    .where(eq(pageNotebookLinks.notebookUuid, uuid));
  const outgoingMessages = await cxn
    .select({
      source: messages.source,
      createdDate: messages.createdDate,
      marked: messages.marked,
    })
    .from(messages)
    .where(eq(messages.target, uuid))
    .orderBy(desc(messages.createdDate))
    .limit(10)
    .then((a) =>
      a.map((m) => ({
        source: m.source,
        date: m.createdDate.valueOf(),
        read: !!m.marked,
      }))
    );
  const incomingMessages = await cxn
    .select({
      target: messages.target,
      created_date: messages.createdDate,
      marked: messages.marked,
    })
    .from(messages)
    .where(eq(messages.source, uuid))
    .orderBy(desc(messages.createdDate))
    .limit(10)
    .then((a) =>
      a.map((m) => ({
        target: m.target,
        date: m.created_date.valueOf(),
        read: m.marked,
      }))
    );
  await cxn.end();
  return {
    notebook: {
      workspace: notebook.workspace,
      uuid: notebook.uuid,
      app: notebook.app,
      email: await getPrimaryUserEmail(notebook.userId),
      userId: notebook.userId,
      token: notebook.token,
    },
    outgoingMessages,
    incomingMessages,
    pages,
    pageCount,
  };
};

export default getAdminNotebookProfile;
