import getNodeEnv from "../internal/getNodeEnv";

const getApiUrl = () => {
  const env = getNodeEnv();
  const defaultUrl =
    env === "development" || env === "test"
      ? "https://samepage.ngrok.io"
      : "https://api.samepage.network";
  try {
    return process.env.API_URL || defaultUrl;
  } catch {
    return defaultUrl;
  }
};

export default getApiUrl;
