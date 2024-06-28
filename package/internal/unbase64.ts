const unbase64 =
  typeof window !== "undefined" && typeof window.atob === "function"
    ? (s: string) => window.atob(s)
    : typeof Buffer !== "undefined"
    ? (s: string) => Buffer.from(s, "base64").toString("binary")
    : () => {
        throw new Error("No base64 decoding function available");
      };

export default unbase64;
