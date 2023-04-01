import { apiPost } from "./apiClient";
import { app } from "./registry";
import { PostToAppBackend } from "./types";

const postToAppBackend: PostToAppBackend = <
  T extends Record<string, unknown> = Record<string, never>
>(
  path: string,
  data: Record<string, unknown>
) => apiPost<T>(`extensions/${app}/${path}`, data);

export default postToAppBackend;
