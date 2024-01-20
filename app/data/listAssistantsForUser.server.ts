const listAssistantsForUser = async () => {
  return {
    data: [
      {
        uuid: "680b2fba-71de-40d2-a300-bc1b5cb9b546",
        name: "Sparky",
        username: "sparky",
        role: "Chief of Staff",
        pinnedApps: [
          { code: "email" },
          { code: "roam" },
          { code: "slack" },
          { code: "notion" },
        ],
      },
    ],
  };
};

export default listAssistantsForUser;
