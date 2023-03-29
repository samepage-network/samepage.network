import { apps, notebooks, tokenNotebookLinks, tokens } from "data/schema";
import { NotFoundError, UnauthorizedError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import { eq, and } from "drizzle-orm/expressions";

const authenticateNotebook = async (args: {
  notebookUuid: string;
  token: string;
  requestId: string;
}) => {
  const { notebookUuid, token, requestId } = args;
  const cxn = await getMysql(requestId);
  const isApp = await cxn
    .select({ app: apps.id })
    .from(apps)
    .where(eq(apps.code, notebookUuid));

  // This is alittle confusing, but notebookUuid can be either a uuid for a specific notebook or an app code.
  if (isApp.length) {
    const tokenLinks = await cxn
      .select({
        notebookUuid: notebooks.uuid,
        tokenUuid: tokenNotebookLinks.tokenUuid,
      })
      .from(tokens)
      .innerJoin(
        tokenNotebookLinks,
        eq(tokenNotebookLinks.tokenUuid, tokens.uuid)
      )
      .innerJoin(notebooks, eq(notebooks.uuid, tokenNotebookLinks.notebookUuid))
      .where(and(eq(tokens.value, token), eq(notebooks.app, isApp[0].app)));
    if (!tokenLinks.length) {
      throw new NotFoundError(
        `This user is not authorized to access this app: ${notebookUuid}`
      );
    }
    return tokenLinks[0];
  }
  const tokenLinks = await cxn
    .select({ token_uuid: tokenNotebookLinks.tokenUuid })
    .from(tokenNotebookLinks)
    .where(eq(tokenNotebookLinks.notebookUuid, notebookUuid));
  if (!tokenLinks.length) {
    throw new NotFoundError(
      notebookUuid
        ? `Could not find Notebook with the Universal Id: ${notebookUuid}`
        : "There is no Notebook Universal Id assigned to this notebook. Make sure to go through the onboarding flow in order to be properly assigned a Universal Id."
    );
  }
  const authenticated = await tokenLinks
    .map((t) => () => {
      const { token_uuid } = t;
      return token_uuid
        ? cxn
            .select({ value: tokens.value })
            .from(tokens)
            .where(eq(tokens.uuid, token_uuid))
            .then(([tokenRecord]) => {
              const storedValue = tokenRecord?.value;
              if (!storedValue) return undefined;
              // should I just query by stored value?
              if (token !== storedValue)
                throw new UnauthorizedError(`Unauthorized notebook and token`);
              return token === storedValue ? token_uuid : undefined;
            })
        : Promise.reject(
            new UnauthorizedError(`Unauthorized notebook and token`)
          );
    })
    .reduce(
      (p, c) => p.then((f) => f || c()),
      Promise.resolve<string | undefined>(undefined)
    );
  if (!authenticated)
    throw new UnauthorizedError(`Unauthorized notebook and token`);
  return { tokenUuid: authenticated, notebookUuid };
};

export default authenticateNotebook;
