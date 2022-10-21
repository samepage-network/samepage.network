import { AppEvent } from "../types";
import { listeners } from "./registerAppEventListener";

const dispatchAppEvent = (event: AppEvent) => {
  if (listeners[event.type]) {
    // @ts-ignore Why doesn't this work?
    listeners[event.type].forEach((c) => c?.(event));
  }
};

export default dispatchAppEvent;
