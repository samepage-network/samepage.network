import apiClient from "./apiClient";

const cache: { current: string } = { current: "" };

const getAppCode = async (): Promise<string> => {
  if (cache.current) return cache.current;
  return apiClient<{ appCode: string }>({
    method: "get-app-code",
  })
    .then((r) => {
      return (cache.current = r.appCode);
    })
    .catch(() => "samepage");
};

export default getAppCode;
