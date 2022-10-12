const base64ToBinary = (state: string) => {
  return typeof window === "undefined"
    ? new Uint8Array(Buffer.from(state, "base64"))
    : new Uint8Array(
        window
          .atob(state)
          .split("")
          .map((c) => c.charCodeAt(0))
      );
};

export default base64ToBinary;
