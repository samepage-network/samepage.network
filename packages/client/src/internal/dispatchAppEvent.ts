import { AppEvent } from "../types";
import { APP_EVENT } from "./events";

const dispatchAppEvent = (detail: AppEvent) => {
  document.body.dispatchEvent(
    new CustomEvent(APP_EVENT, {
      detail,
    })
  );
};

export default dispatchAppEvent;
