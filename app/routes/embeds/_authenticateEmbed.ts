import { LoaderArgs } from "@remix-run/node";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import parseRemixContext from "~/data/parseRemixContext.server";

const authenticateEmbed = async ({ request, context }: LoaderArgs) => {
  const searchParams = new URL(request.url).searchParams;
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
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
  const { tokenUuid } = await authenticateNotebook({
    notebookUuid,
    token,
    requestId,
  });
  return { auth: true as const, notebookUuid, requestId, token, tokenUuid };
};

export default authenticateEmbed;
