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
  {
    id: "granular-changes",
    name: "Granular Changes",
    description: "(EXPERIMENTAL) Sync changes between notebooks granularly",
    type: "boolean",
    default: false,
  },
] as const;

export type DefaultSetting = typeof defaultSettings[number];

export default defaultSettings;
