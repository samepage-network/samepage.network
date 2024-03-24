import { AppEvent } from "./types";

type AppEventMap = {
  [k in AppEvent as k["type"]]: k;
};

export const listeners: {
  [k in AppEvent["type"]]?: ((e: AppEventMap[k]) => void)[];
} = {};

export const onAppEvent = <T extends AppEvent["type"]>(
  t: T,
  callback: (e: AppEventMap[T]) => void
) => {
  // @ts-ignore Why doesn't this work?
  if (listeners[t]) listeners[t].push(callback);
  // @ts-ignore Why doesn't this work?
  else listeners[t] = [callback];
  return () => {
    const index = listeners[t]?.indexOf(callback);
    if (typeof index === "number" && index >= 0) listeners[t]?.splice(index, 1);
  };
};
