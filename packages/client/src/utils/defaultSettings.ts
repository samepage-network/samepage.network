const defaultSettings = [
  {
    id: "auto-connect",
    name: "Auto Connect",
    type: "boolean",
    default: false,
    description: "Automatically connect to the SamePage Network",
  },
] as const;

export type DefaultSetting = typeof defaultSettings[number];

export default defaultSettings;
