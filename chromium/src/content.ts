import setupSamePageClient from "samepage/protocols/setupSamePageClient";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import defaultSettings from "samepage/utils/defaultSettings";
import renderOverlay from "./utils/renderOverlay";
import { AppData, SupportedNotebook } from "./utils/types";
import { v4 } from "uuid";
import CommandPalette from "./components/CommandPalette";
import renderToast from "./components/Toast";
import { apiPost } from "samepage/internal/apiClient";
import { getSetting } from "samepage/internal/registry";

// TODO - duplicated from index.css - need to figure out how to import directly in extension manifest.
const indexCss = `.notion-topbar > div {
  overflow: unset !important;
}

.samepage-onboarding-portal .bp4-overlay {
  z-index: 1000;
}

.samepage-shared-page-status {
  margin-bottom: 0;
}

div[id*="samepage-shared"] {
  padding: 0 96px;
}

.samepage-command-portal {
  z-index: 150;
}

.samepage-command-menu {
  z-index: 200;
}

.samepage-command-menu .bp4-overlay-content {
  width: 470px;
}

#notion-app a.bp4-button {
  cursor: pointer;
}`;

const addStyle = (content: string, id = v4().slice(0, 8)): HTMLStyleElement => {
  const existing = document.getElementById(id) as HTMLStyleElement;
  if (existing) return existing;
  const css = document.createElement("style");
  css.textContent = content;
  css.id = id;
  document.getElementsByTagName("head")[0].appendChild(css);
  return css;
};

const globalSettings: Record<string, string> = {};
const SUPPORTED_APPS = [
  {
    test: /notion\.so/,
    // TODO: will probably want to pass in token here in the future
    id: "notion",
  },
];

const setupUserSettings = async (data: SupportedNotebook) => {
  const settings = defaultSettings.map((d) => ({
    id: d.id, // string
    name: d.name, // string
    description: d.description, // string
    value: d.default, // boolean or string
    type: d.type, // "boolean" or "string"
  }));
  const key = `${data.app}:${data.workspace}`;
  await chrome.storage.sync.get(key).then((d) => {
    settings.forEach((s) => {
      globalSettings[s.id] = d[key]?.[s.id] || s.value;
    });
  });
};

const commands: Record<string, () => void> = {};

const setupClient = (notebook: SupportedNotebook) => {
  // blueprintjs fails to load through samepage.css
  // but ideally we just remove blueprint entirely in the future
  if (!document.getElementById("blueprint-css")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://unpkg.com/@blueprintjs/core@^4.8.0/lib/css/blueprint.css";
    link.id = "blueprint-css";
    document.head.appendChild(link);
  }

  const key = `${notebook.app}:${notebook.workspace}`;
  const { unload } = setupSamePageClient({
    ...notebook,
    getSetting: (s) => globalSettings[s],
    setSetting: (s, v) => {
      globalSettings[s] = v;
      chrome.storage.sync.set({ [key]: globalSettings });
    },
    notificationContainerPath: ".notion-topbar-share-menu",
    renderOverlay,
    addCommand: ({ label, callback }) => {
      commands[label] = callback;
    },
    removeCommand: ({ label }) => {
      delete commands[label];
    },
    onAppLog: (evt) =>
      evt.intent !== "debug" &&
      renderToast({
        id: evt.id,
        content: evt.content,
        intent:
          evt.intent === "error"
            ? "danger"
            : evt.intent === "info"
            ? "primary"
            : evt.intent,
      }),
  });
  document.addEventListener("keydown", (e) => {
    if (
      !e.altKey &&
      !e.shiftKey &&
      !e.ctrlKey &&
      e.metaKey &&
      /^(Key)?[pP]$/.test(e.key)
    ) {
      renderOverlay({
        Overlay: CommandPalette,
        props: {
          commands: Object.entries(commands)
            .map(([label, callback]) => ({
              label,
              callback,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        },
      });
      e.preventDefault();
      e.stopPropagation();
    }
  });
  return unload;
};

const setupSharePageWithNotebook = (data: SupportedNotebook) => {
  const id = data.app.toLowerCase();
  const getCurrentNotebookPageId = () =>
    document.location.pathname.replace(/^\//, "");
  const { unload, refreshContent } = loadSharePageWithNotebook({
    getCurrentNotebookPageId: async () => getCurrentNotebookPageId(),
    ensurePageByTitle: (title) =>
      apiPost<{ notebookPageId: string; preExisting: boolean }>(
        `extensions/${id}/backend`,
        {
          type: "ENSURE_PAGE_BY_TITLE",
          data: { title, path: document.location.pathname },
        }
      ),
    encodeState: (notebookPageId: string) =>
      apiPost(`extensions/${id}/backend`, {
        type: "ENCODE_STATE",
        data: { notebookPageId, notebookUuid: getSetting("uuid") },
      }),
    overlayProps: {
      viewSharedPageProps: {},
      sharedPageStatusProps: {
        getPaths: (notebookPageId) => {
          const uuidRaw = /[a-f0-9]{32}$/.exec(notebookPageId)?.[0];
          if (!uuidRaw) return [];
          const pageUuid = `${uuidRaw.slice(0, 8)}-${uuidRaw.slice(
            8,
            12
          )}-${uuidRaw.slice(12, 16)}-${uuidRaw.slice(16, 20)}-${uuidRaw.slice(
            20,
            32
          )}`;
          const firstBlock = document.querySelector(
            `.notion-frame div[data-block-id="${pageUuid}"`
          );
          if (!firstBlock || !firstBlock.parentElement) return [];
          const contentEditable = firstBlock.closest(`.whenContentEditable`);
          if (!contentEditable || !contentEditable.parentElement) return [];
          const container = document.createElement("div");
          contentEditable.parentElement.insertBefore(
            container,
            contentEditable
          );
          const sel = v4();
          container.setAttribute("data-samepage-shared", sel);
          return [`div[data-samepage-shared="${sel}"]`];
        },
        observer({ onload, onunload }) {
          const ref = window.setInterval(() => {
            const notebookPageId = getCurrentNotebookPageId();
            if (!notebookPageId) return;
            const existingNotebookPageIds = new Set(
              Array.from(
                document.querySelectorAll(`[data-samepage-shared*="-"]`)
              ).map((d) =>
                (d.previousElementSibling?.id || "").replace(
                  /^samepage-shared-/,
                  ""
                )
              )
            );
            if (!existingNotebookPageIds.has(notebookPageId)) {
              existingNotebookPageIds.forEach(onunload);
              onload(notebookPageId);
            }
          }, 100);
          return () => window.clearInterval(ref);
        },
      },
    },
    openPage: async (notebookPageId) => {
      const href = `/${notebookPageId}`;
      window.location.assign(href);
      return { url: href, notebookPageId };
    },
    deletePage: (notebookPageId) =>
      apiPost(`extensions/${id}/backend`, {
        type: "DELETE_PAGE",
        data: { notebookPageId },
      }),
    decodeState: async (notebookPageId, state) => {
      return apiPost(`extensions/${id}/backend`, {
        type: "DECODE_STATE",
        data: { notebookPageId, state },
      });
    },
    onConnect: () => {
      let refreshRef = 0;
      const listener = () => {
        window.clearTimeout(refreshRef);
        refreshRef = window.setTimeout(
          () => refreshContent({ notebookPageId: getCurrentNotebookPageId() }),
          1000
        );
      };
      document.body.addEventListener("keydown", listener);
      return () => {
        document.body.removeEventListener("keydown", listener);
      };
    },
  });

  return unload;
};

const setupToolSpecificProtocol = () => {
  const el = addStyle(indexCss);
  return () => {
    el.remove();
  };
};

const setupProtocols = (data: SupportedNotebook) => {
  const unloadSharePageWithNotebook = setupSharePageWithNotebook(data);
  const unloadToolSpecificProtocol = setupToolSpecificProtocol();
  // add more here
  return () => {
    unloadToolSpecificProtocol();
    unloadSharePageWithNotebook();
  };
};

const setup = async () => {
  let appData: AppData = false;
  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (message.type === "SETUP") {
      sendResponse(appData);
    } else if (message.type === "CONNECT") {
      commands["Onboard to SamePage"]?.();
      sendResponse(false);
    } else {
      sendResponse(false);
    }
  });
  const appInfo = SUPPORTED_APPS.find((a) => a.test.test(window.location.href));
  if (appInfo) {
    appData = await apiPost<{
      data: AppData;
    }>(`extensions/${appInfo.id}/backend`, { type: "SETUP" }).then(
      (r) => r.data
    );
    if (appData) {
      await setupUserSettings(appData);
      const unloadClient = setupClient(appData);
      const unloadProtocols = setupProtocols(appData);
      // chrome.action.setBadgeText({
      //   text: "ON",
      // });
      return () => {
        unloadProtocols();
        unloadClient();
      };
    }
  }
  return () => {};
};

setup();
