const unbase64 = (() => {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return (s: string) => window.atob(s);
  } else if (typeof Buffer !== "undefined") {
    return (s: string) => Buffer.from(s, "base64").toString("binary");
  } else {
    throw new Error("No base64 decoding function available");
  }
})();

export default unbase64;
