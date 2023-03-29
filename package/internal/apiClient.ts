import {
  zAuthenticatedBody,
  zAuthHeaders,
  zUnauthenticatedBody,
} from "./types";
import { getSetting } from "./registry";
import getApiUrl from "../utils/getApiUrl";
import { z } from "zod";

export type HandleFetchArgs = {
  path?: string;
  domain?: string;
  data?: Record<string, unknown>;
  authorization?: string;
};

const handleFetch = <T extends Record<string, unknown> = Record<string, never>>(
  transformArgs: (...info: [URL, RequestInit]) => Parameters<typeof fetch>,
  {
    method,
    path,
    domain,
    authorization,
  }: Pick<RequestInit, "method"> & Omit<HandleFetchArgs, "data">
) => {
  const url = new URL(`${domain || getApiUrl()}/${path}`);
  return fetch(
    ...transformArgs(url, {
      method,
      headers: authorization
        ? {
            Authorization: authorization,
          }
        : undefined,
    })
  ).then((r) => {
    if (!r.ok) {
      return r.text().then((e) => Promise.reject(new Error(e)));
    } else if (r.status === 204) {
      return {} as T;
    }
    return r
      .json()
      .then((r) => r as T)
      .catch(() => r.text().then((e) => Promise.reject(new Error(e))));
  });
};

const handleUrlFetch =
  (method: "GET" | "DELETE") =>
  <T extends Record<string, unknown> = Record<string, never>>(
    args: string | HandleFetchArgs,
    _data?: Record<string, unknown>
  ) => {
    const { data = {}, ...fetchArgs } =
      typeof args === "string" ? { path: args, data: _data } : args;

    return handleFetch<T>((url, init) => {
      Object.entries(data).forEach(([k, v]) =>
        url.searchParams.set(k, v as string)
      );
      return [
        url,
        {
          ...init,
          method,
        },
      ];
    }, fetchArgs);
  };

const handleBodyFetch =
  (method: "POST" | "PUT") =>
  <T extends Record<string, unknown> = Record<string, never>>(
    args: string | HandleFetchArgs,
    _data?: Record<string, unknown>
  ) => {
    const { data, ...fetchArgs } =
      typeof args === "string" ? { path: args, data: _data } : args;

    const body = JSON.stringify(data || {});

    return handleFetch<T>(
      (url, init) => [
        url,
        {
          ...init,
          body,
          headers: {
            ...(init.headers || {}),
            "Content-Type": "application/json",
          },
          method,
        },
      ],
      fetchArgs
    );
  };

export const apiPost = handleBodyFetch("POST");

export const apiGet = handleUrlFetch("GET");

const zMethodBody = zUnauthenticatedBody.or(
  zAuthenticatedBody.and(
    zAuthHeaders.partial().or(z.object({ authorization: z.string() }))
  )
);

export type RequestBody = z.infer<typeof zMethodBody>;

const apiClient = <T extends Record<string, unknown>>(data: RequestBody) =>
  apiPost<T>(
    "authorization" in data
      ? {
          path: "page",
          data,
          authorization: data.authorization,
        }
      : {
          path: "page",
          data: {
            notebookUuid: getSetting("uuid"),
            token: getSetting("token"),
            ...data,
          },
        }
  );

export default apiClient;
