import { AppEvent } from "../types";

const dispatchAppEvent = (detail: AppEvent) => {
  document.body.dispatchEvent(
    new CustomEvent(`samepage:event`, {
      detail,
    })
  );
};

export default dispatchAppEvent;
