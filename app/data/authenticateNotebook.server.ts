import { tokenNotebookLinks, tokens } from "data/schema";
import { NotFoundError, UnauthorizedError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import { eq } from "drizzle-orm/expressions";

const authenticateNotebook = async (args: {
  notebookUuid: string;
  token: string;
  requestId: string;
}) => {
  const { notebookUuid, token, requestId } = args;
  const cxn = await getMysql(requestId);
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
  return authenticated;
};

export default authenticateNotebook;
