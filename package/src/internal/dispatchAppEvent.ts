import { AppEvent } from "../types";
import { listeners } from "./registerAppEventListener";
import { onAppEventHandler } from "./registry";

const dispatchAppEvent = (event: AppEvent) => {
  const result = onAppEventHandler(event);
  if (!result && listeners[event.type]) {
    // @ts-ignore Why doesn't this work?
    listeners[event.type].forEach((c) => c?.(event));
  }
};

export default dispatchAppEvent;
