import { setSetting } from "package/internal/registry";
import { useSearchParams } from "react-router-dom";
import unbase64 from "../internal/unbase64";

const useCredentials = () => {
  const [searchParams] = useSearchParams();
  const auth = searchParams.get("auth");
  if (!auth) return;
  const [uuid, token] = unbase64(auth.replace(/^Basic /, "")).split(":");
  setSetting("uuid", uuid);
  setSetting("token", token);
  return { notebookUUid: uuid, token };
};

export default useCredentials;
