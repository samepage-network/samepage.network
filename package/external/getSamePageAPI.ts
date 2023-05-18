import type { SamePageAPI } from "../internal/types";

const getSamePageAPI = async () => {
  if (typeof window !== "undefined") {
    const parentWindow = window.parent !== window ? window.parent : window;
    if (typeof parentWindow.samepage !== "undefined") {
      return parentWindow.samepage;
    } else {
      return new Promise<SamePageAPI>((resolve, reject) => {
        const timeoutRef = window.setTimeout(() => {
          reject(new Error("Timed out waiting for SamePage API"));
        }, 1000 * 60 * 10);
        parentWindow.document.body.addEventListener(
          "samepage:loaded",
          () => {
            window.clearTimeout(timeoutRef);
            resolve(parentWindow.samepage);
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
