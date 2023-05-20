const unbase64 =
  typeof window !== "undefined"
    ? (s: string) => window.atob(s)
    : (s: string) => Buffer.from(s, "base64").toString();

export default unbase64;
