import { test, expect } from "@playwright/test";
import { getSetting } from "package/internal/registry";
import defaultSetSetting from "../../../package/utils/defaultSetSetting";

test("default set setting", () => {
  const ls = global.localStorage;
  const storage: Record<string, string> = {};
  // @ts-ignore
  global.localStorage = {
    getItem: (s: string) => storage[s],
    setItem: (s: string, v: string) => (storage[s] = v),
  };
  defaultSetSetting("uuid", "foobar");
  expect(getSetting("uuid")).toEqual("foobar");
  global.localStorage = ls;
});
