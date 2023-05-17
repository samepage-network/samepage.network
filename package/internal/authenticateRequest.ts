import { LoaderFunctionArgs } from "react-router";
import parseRequestContext from "./parseRequestContext";

const authenticateRequest = async ({
  args: { request, context },
  authenticateNotebook,
}: {
  args: LoaderFunctionArgs;
  authenticateNotebook: (args: {
    notebookUuid: string;
    token: string;
    requestId: string;
  }) => Promise<{
    tokenUuid: string;
    app: string;
    workspace: string;
  }>;
}) => {
  const searchParams = new URL(request.url).searchParams;
  const { requestId } = parseRequestContext(context);
  const auth = searchParams.get("auth");
  if (!auth) {
    return { auth: false as const, requestId };
  }
  const [notebookUuid, token] = Buffer.from(auth, "base64")
    .toString()
    .split(":");
  if (!notebookUuid || !token) {
    return { auth: false as const, requestId };
  }
  const { tokenUuid, app, workspace } = await authenticateNotebook({
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
    param: auth,
  };
};

export default authenticateRequest;
