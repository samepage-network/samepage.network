const binaryToBase64 = (state: Uint8Array) => {
  return typeof window === "undefined"
    ? Buffer.from(state).toString("base64")
    : window.btoa(String.fromCharCode.apply(null, Array.from(state)));
};

export default binaryToBase64;
