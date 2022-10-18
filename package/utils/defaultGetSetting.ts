import type { GetSetting } from "../types";

const defaultGetSetting: GetSetting = (s: string) => {
  const settings = localStorage.getItem("samepage:settings");
  if (!settings) return "";
  return JSON.parse(settings)?.[s];
};

export default defaultGetSetting;
