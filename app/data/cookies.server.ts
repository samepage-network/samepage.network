import { createCookie } from "@remix-run/node";

export const offlinePrefs = createCookie("offline-prefs", {
  maxAge: 604_800, // one week
});
