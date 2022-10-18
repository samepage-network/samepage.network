import { NotFoundError, UnauthorizedError } from "@dvargas92495/app/backend/errors.server";
import getMysql from "fuegojs/utils/mysql";

const authenticateNotebook = async (args: {
  notebookUuid: string;
  token: string;
  requestId: string;
}) => {
  const { notebookUuid, token, requestId } = args;
  const cxn = await getMysql(requestId);
  const [tokenLinks] = await cxn.execute(
    `SELECT token_uuid FROM token_notebook_links
      where notebook_uuid = ?`,
    [notebookUuid]
  );
  const tokens = tokenLinks as { token_uuid: string }[];
  if (!tokens.length) {
    throw new NotFoundError(`Could not find notebook`);
  }
  const authenticated = tokens
    .map(
      (t) => () =>
        cxn
          .execute(
            `SELECT value FROM tokens 
    where uuid = ?`,
            [t.token_uuid]
          )
          .then(([values]) => {
            const storedValue = (values as { value: string }[])?.[0]?.value;
            if (!storedValue) return false;
            // should I just query by stored value?
            if (token !== storedValue)
              throw new UnauthorizedError(`Unauthorized notebook and token`);
            return token === storedValue;
          })
    )
    .reduce((p, c) => p.then((f) => f || c()), Promise.resolve(false));
  if (!authenticated)
    throw new UnauthorizedError(`Unauthorized notebook and token`);
  return true;
};

export default authenticateNotebook;
