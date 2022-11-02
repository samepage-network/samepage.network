import type { GetSetting } from "../internal/types";

const defaultGetSetting: GetSetting = (s: string) => {
  const settings =
    typeof localStorage === "undefined"
      ? "{}"
      : localStorage.getItem("samepage:settings");
  if (!settings) return "";
  return JSON.parse(settings)?.[s];
};

export default defaultGetSetting;
