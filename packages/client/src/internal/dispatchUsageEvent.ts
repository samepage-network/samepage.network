import { Stats } from "../types";

const dispatchAppEvent = (detail: Stats) => {
  document.body.dispatchEvent(
    new CustomEvent(`samepage:usage`, {
      detail,
    })
  );
};

export default dispatchAppEvent;
