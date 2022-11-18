const defaultSettings = [
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
] as const;

export type DefaultSetting = typeof defaultSettings[number];

export default defaultSettings;
