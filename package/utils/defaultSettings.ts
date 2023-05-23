import type { GetSetting, SetSetting, SettingId } from "../internal/types";

export type DefaultSetting = {
  id: SettingId;
  name: string;
  type: "string";
  default: string;
  description: string;
};

const defaultSettings: DefaultSetting[] = [
  {
    id: "uuid",
    name: "Notebook Universal Id",
    type: "string",
    default: "",
    description: "Universal Id assigned to this Notebook by SamePage.",
  },
  {
    id: "token",
    name: "Notebook Token",
    type: "string",
    default: "",
    description: "Token assigned to this Notebook by SamePage.",
  },
];

const nodeSettings: Record<SettingId, string> = { token: "", uuid: "" };

export const defaultSetSetting: SetSetting = (s, v) => {
  if (typeof localStorage !== "undefined") {
    const settings = localStorage.getItem("samepage:settings");
    localStorage.setItem(
      "samepage:settings",
      JSON.stringify({ ...(settings ? JSON.parse(settings) : {}), [s]: v })
    );
  } else {
    nodeSettings[s] = v;
  }
};

export const defaultGetSetting: GetSetting = (s: SettingId) => {
  if (typeof localStorage === "undefined") return nodeSettings[s] || "";
  const settings = localStorage.getItem("samepage:settings");
  if (!settings) return "";
  return JSON.parse(settings)?.[s];
};

export default defaultSettings;
