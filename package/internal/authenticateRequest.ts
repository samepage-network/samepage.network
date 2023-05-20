import { LoaderFunctionArgs } from "react-router";
import parseCredentialsFromRequest from "./parseCredentialsFromRequest";
import { AuthenticateNotebook } from "./types";

// @deprecated - see SharedPagesTab
const authenticateRequest = async ({
  args,
  authenticateNotebook,
}: {
  args: LoaderFunctionArgs;
  authenticateNotebook: AuthenticateNotebook;
}) => {
  const { auth, notebookUuid, token, requestId } =
    parseCredentialsFromRequest(args);
  if (!auth) return { auth, requestId };
  const { tokenUuid, app, workspace, userId } = await authenticateNotebook({
    notebookUuid,
    token,
    requestId,
  });
  return {
    auth: true as const,
    notebookUuid,
    app,
    workspace,
    requestId,
    token,
    tokenUuid,
    userId,
  };
};

export default authenticateRequest;
