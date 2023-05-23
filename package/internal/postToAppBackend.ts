import { apiPost } from "./apiClient";
import base64 from "./base64";
import getAppCode from "./getAppCode";
import { getSetting } from "./registry";
import { PostToAppBackend } from "./types";

// TODO: lots of redundancy here
const postToAppBackend: PostToAppBackend = <
  T extends Record<string, unknown> = Record<string, never>
>(
  path: string,
  data: Record<string, unknown>
) =>
  getAppCode().then((app) =>
    apiPost<T>({
      path: `extensions/${app}/${path}`,
      data,
      authorization: `Basic ${base64(
        `${getSetting("uuid")}:${getSetting("token")}`
      )}`,
    })
  );

export default postToAppBackend;
