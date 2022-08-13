import { APP_EVENT } from "./events";
import { AppEvent } from "../types";
import { onAppEventHandler } from "./registry";

const onAppEvent = () =>
  document.body.addEventListener(APP_EVENT, ((e: CustomEvent) =>
    onAppEventHandler(e.detail as AppEvent)) as EventListener);

export default onAppEvent;
