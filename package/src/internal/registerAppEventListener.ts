import { APP_EVENT } from "./events";
import { AppEvent } from "../types";
import { onAppEventHandler } from "./registry";

type AppEventMap = {
  [k in AppEvent as k["type"]]: k;
};

const listeners: { [k in AppEvent["type"]]?: (e: AppEventMap[k]) => void } = {};

export const onAppEvent = <T extends AppEvent["type"]>(
  t: T,
  callback: (e: AppEventMap[T]) => void
) => {
  // @ts-ignore Why doesn't this work?
  listeners[t] = callback;
};

const registerAppEventListener = () => {
  const listener = ((e: CustomEvent) => {
    const event = e.detail as AppEvent;
    const result = onAppEventHandler(e.detail as AppEvent);
    if (!result) {
      // @ts-ignore Why doesn't this work?
      listeners[event.type]?.(event);
    }
  }) as EventListener;
  document.body.addEventListener(APP_EVENT, listener);
  return () => document.body.removeEventListener(APP_EVENT, listener);
};

export default registerAppEventListener;
