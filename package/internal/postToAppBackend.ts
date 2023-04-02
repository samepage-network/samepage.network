import { apiPost } from "./apiClient";
import { app, getSetting } from "./registry";
import { PostToAppBackend } from "./types";

const base64 = (s: string) =>
  typeof window.btoa === "undefined"
    ? Buffer.from(s).toString("base64")
    : window.btoa(s);

const postToAppBackend: PostToAppBackend = <
  T extends Record<string, unknown> = Record<string, never>
>(
  path: string,
  data: Record<string, unknown>
) =>
  apiPost<T>({
    path: `extensions/${app}/${path}`,
    data,
    authorization: `Basic ${base64(
      `${getSetting("uuid")}:${getSetting("token")}`
    )}`,
  });

export default postToAppBackend;
