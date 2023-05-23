import { apiPost } from "./apiClient";
import base64 from "./base64";
import getAppCode from "./getAppCode";
import { getSetting } from "./registry";
import { PostToAppBackend } from "./types";

const postToAppBackend: PostToAppBackend = async ({
  path = "backend",
  data = {},
  app: _app = "",
}) => {
  const app = _app || (await getAppCode());
  return apiPost({
    path: `extensions/${app}/${path}`,
    data,
    authorization: `Basic ${base64(
      `${getSetting("uuid")}:${getSetting("token")}`
    )}`,
  });
};

export default postToAppBackend;
