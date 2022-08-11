export type HandleFetchArgs = {
  path?: string;
  domain?: string;
  data?: Record<string, unknown>;
};

const handleFetch = <T extends Record<string, unknown> = Record<string, never>>(
  transformArgs: (...info: [URL, RequestInit]) => Parameters<typeof fetch>,
  {
    method,
    path,
    domain,
  }: Pick<RequestInit, "method"> & Omit<HandleFetchArgs, "data">
) => {
  const url = new URL(
    `${domain || process.env.API_URL || "https://api.samepage.network"}/${path}`
  );
  return fetch(
    ...transformArgs(url, {
      method,
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
      .catch(() => Promise.reject(r.text()));
  });
};

const handleBodyFetch =
  (method: "POST" | "PUT") =>
  <T extends Record<string, unknown> = Record<string, never>>(
    args: string | HandleFetchArgs,
    _data?: Record<string, unknown>
  ) => {
    const { data, ...fetchArgs } =
      typeof args === "string" ? { path: args, data: _data } : args;

    const body =
      process.env.NODE_ENV === "development"
        ? JSON.stringify({ dev: true, ...data })
        : JSON.stringify(data || {});

    return handleFetch<T>(
      (url, init) => [
        url,
        {
          ...init,
          body,
          headers: {
            "Content-Type": "application/json",
          },
          method,
        },
      ],
      fetchArgs
    );
  };

const apiPost = handleBodyFetch("POST");

const apiClient = <T extends Record<string, unknown>>(
  data: Record<string, unknown> = {}
) =>
  apiPost<T>({
    path: "page",
    data,
  });

export default apiClient;
