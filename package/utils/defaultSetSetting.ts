import type { SetSetting } from "../internal/types";

const defaultSetSetting: SetSetting = (s: string, v: string) => {
  if (typeof localStorage !== "undefined") {
    const settings = localStorage.getItem("samepage:settings");
    localStorage.setItem(
      "samepage:settings",
      JSON.stringify({ ...(settings ? JSON.parse(settings) : {}), [s]: v })
    );
  }
};

export default defaultSetSetting;
