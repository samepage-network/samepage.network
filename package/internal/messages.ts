const MESSAGES = {
  // from SamePage
  ERROR: {
    title: "",
    description: "",
    buttons: [],
  },
  AUTHENTICATION: {
    title: "",
    description: "",
    buttons: [],
  },
  INITIALIZE_P2P: {
    title: "",
    description: "",
    buttons: [],
  },
  OFFER: {
    title: "",
    description: "",
    buttons: [],
  },
  ANSWER: {
    title: "",
    description: "",
    buttons: [],
  },

  // Page Sync Protocol
  SHARE_PAGE: {
    title: "Share Page",
    description: `Notebook {app}/{workspace} is attempting to share page {title}. Would you like to accept?`,
    buttons: ["accept", "reject"],
  },
  SHARE_PAGE_RESPONSE: {
    title: "",
    description: "",
    buttons: [],
  },
  SHARE_PAGE_UPDATE: {
    title: "",
    description: "",
    buttons: [],
  },
  SHARE_PAGE_FORCE: {
    title: "",
    description: "",
    buttons: [],
  },
  REQUEST_PAGE_UPDATE: {
    title: "",
    description: "",
    buttons: [],
  },

  // Query Protocol
  QUERY: {
    title: "",
    description: "",
    buttons: [],
  },
  QUERY_RESPONSE: {
    title: "",
    description: "",
    buttons: [],
  },
} as const;

export type Operation = keyof typeof MESSAGES;

export default MESSAGES;
