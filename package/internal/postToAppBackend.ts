import { apiPost } from "./apiClient";
import { app, getSetting } from "./registry";
import { PostToAppBackend } from "./types";

const postToAppBackend: PostToAppBackend = <
  T extends Record<string, unknown> = Record<string, never>
>(
  path: string,
  data: Record<string, unknown>
) =>
  apiPost<T>({
    path: `extensions/${app}/${path}`,
    data,
    authorization: `Basic ${Buffer.from(
      `${getSetting("uuid")}:${getSetting("token")}`
    ).toString("base64")}`,
  });

export default postToAppBackend;
