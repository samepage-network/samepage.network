const base64 =
  typeof window !== "undefined"
    ? (s: string) => window.btoa(s)
    : (s: string) => Buffer.from(s).toString("base64");

export default base64;
