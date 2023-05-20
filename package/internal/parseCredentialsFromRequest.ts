import { LoaderFunctionArgs } from "react-router";
import parseRequestContext from "./parseRequestContext";
import unbase64 from "./unbase64";

const parseCredentialsFromRequest = ({
  request,
  context,
}: LoaderFunctionArgs) => {
  const searchParams = new URL(request.url).searchParams;
  const { requestId } = parseRequestContext(context);
  const auth = searchParams.get("auth");
  if (!auth) {
    return { auth: false as const, requestId };
  }
  const [notebookUuid, token] = unbase64(auth).split(":");
  if (!notebookUuid || !token) {
    return { auth: false as const, requestId };
  }
  return { auth: true as const, notebookUuid, token, requestId };
};

export default parseCredentialsFromRequest;
