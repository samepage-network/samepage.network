const binaryToBase64 = (state: Uint8Array) => {
  return typeof window === "undefined"
    ? Buffer.from(state).toString("base64")
    : window.btoa(
        Array.from(state)
          .map((s) => String.fromCharCode(s))
          .join("")
      );
};

export default binaryToBase64;
