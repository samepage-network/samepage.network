const defaultSettings = [
  {
    id: "auto-connect",
    name: "Auto Connect",
    type: "boolean",
    default: false,
    description: "Automatically connect to the SamePage Network",
  },
  {
    id: "granular-changes",
    name: "Granular Changes",
    description: "Send changes granularly",
    type: "boolean",
    default: false,
  },
] as const;

export type DefaultSetting = typeof defaultSettings[number];

export default defaultSettings;
