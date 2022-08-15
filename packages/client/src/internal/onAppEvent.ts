import { APP_EVENT } from "./events";
import { AppEvent } from "../types";
import { onAppEventHandler } from "./registry";

const onAppEvent = () => {
  const listener = ((e: CustomEvent) =>
    onAppEventHandler(e.detail as AppEvent)) as EventListener;
  document.body.addEventListener(APP_EVENT, listener);
  return () => document.body.removeEventListener(APP_EVENT, listener);
};

export default onAppEvent;
