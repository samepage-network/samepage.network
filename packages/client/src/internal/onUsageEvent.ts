import { USAGE_EVENT } from "./events";
import { Stats } from "../types";

const onUsageEvent = (handler: (event: Stats) => void) =>
  document.body.addEventListener(USAGE_EVENT, ((e: CustomEvent) =>
    handler(e.detail as Stats)) as EventListener);

export default onUsageEvent;
