import type { SamePageAPI } from "../internal/types";

const getSamePageAPI = async () => {
  if (typeof window !== "undefined") {
    if (typeof window.samepage !== "undefined") {
      return window.samepage;
    } else {
      return new Promise<SamePageAPI>((resolve) => {
        document.body.addEventListener(
          "samepage:loaded",
          () => {
            resolve(window.samepage);
          },
          { once: true }
        );
      });
    }
  }
  return Promise.reject(
    new Error("`getSamePageAPI` is currently only supported in the browser.")
  );
};

export default getSamePageAPI;
