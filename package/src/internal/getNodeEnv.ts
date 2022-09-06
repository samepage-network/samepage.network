const getNodeEnv = () => {
  try {
    return process.env.NODE_ENV || "production";
  } catch {
    return "production";
  }
};

export default getNodeEnv;
