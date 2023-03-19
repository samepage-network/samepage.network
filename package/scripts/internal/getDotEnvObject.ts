const IGNORE_ENV = ["HOME"];

const getDotEnvObject = (): Record<string, string> => {
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env)
        .filter(([k]) => !/[()]/.test(k))
        .filter(([k]) => !IGNORE_ENV.includes(k))
    ),
  };
  return Object.fromEntries(
    Object.keys(env).map((k) => [`process.env.${k}`, JSON.stringify(env[k])])
  );
};

export default getDotEnvObject;
