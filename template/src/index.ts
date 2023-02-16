import setupSamePageClient from "samepage/protocols/setupSamePageClient";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import defaultSettings from "samepage/utils/defaultSettings";

const setupUserSettings = () => {
  const settings = defaultSettings.map((d) => ({
    id: d.id, // string
    name: d.name, // string
    description: d.description, // string
    value: d.default, // boolean or string
    type: d.type, // "boolean" or "string"
  }));
  // hook up these settings to the UI!
  console.log(settings);
};

const setupClient = () => {
  const { unload } = setupSamePageClient({
    // Notebook properties
    // app: "{{app}}",
    // workspace: "TODO",
    // Interact with settings
    // getSetting: (s) => localStorage.getItem(s),
    // setSetting: (s, v) => localStorage.setItem(s, v),
    // Interact with user
    // addCommand: window.roamAlphaAPI.ui.commandPalette.addCommand,
    // removeCommand: window.roamAlphaAPI.ui.commandPalette.removeCommand,
  });
  return unload;
};

const setupSharePageWithNotebook = () => {
  const { unload } = loadSharePageWithNotebook({
    // getCurrentNotebookPageId,
    // createPage,
    // openPage,
    // deletePage,
    // applyState,
    // calculateState,
    // overlayProps,
  });

  return unload;
};

const setupToolSpecificProtocol = () => {
  // anything specific to this tool
  return () => {};
};

const setupProtocols = () => {
  const unloadSharePageWithNotebook = setupSharePageWithNotebook();
  const unloadToolSpecificProtocol = setupToolSpecificProtocol();
  // add more here
  return () => {
    unloadToolSpecificProtocol();
    unloadSharePageWithNotebook();
  };
};

const setup = () => {
  setupUserSettings();
  const unloadClient = setupClient();
  const unloadProtocols = setupProtocols();
  return () => {
    unloadProtocols();
    unloadClient();
  };
};

export default setup;
