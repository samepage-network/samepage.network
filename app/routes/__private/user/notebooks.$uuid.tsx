export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import remixAppAction from "~/data/remixAppAction.server";
import remixAppLoader from "~/data/remixAppLoader.server";
import Button from "~/components/Button";
import TextInput from "~/components/TextInput";
import {
  ActionFunction,
  LoaderFunction,
  redirect,
  LinksFunction,
} from "@remix-run/node";
import blueprintcss from "@blueprintjs/core/lib/css/blueprint.css";
import blueprinticonscss from "@blueprintjs/icons/lib/css/blueprint-icons.css";
import {
  useLoaderData,
  Link,
  Outlet,
  useMatches,
  useSubmit,
} from "@remix-run/react";
import getUserNotebookProfile from "~/data/getUserNotebookProfile.server";
import { useEffect, useRef, useState } from "react";
import setupSamePageClient from "package/protocols/setupSamePageClient";
import { AddCommand, ApplyState, InitialSchema } from "package/internal/types";
import loadSharePageWithNotebook from "package/protocols/sharePageWithNotebook";
import { createRoot } from "react-dom/client";
import { v4 } from "uuid";
import { downloadFileContent } from "~/data/downloadFile.server";
import uploadFile from "~/data/uploadFile.server";
import Dialog from "~/components/Dialog";
import { z } from "zod";
import { NotFoundResponse } from "~/data/responses.server";

const commands: Parameters<AddCommand>[0][] = [];
let delayedLoad: string;

const SingleNotebookPage = () => {
  const data =
    useLoaderData<Awaited<ReturnType<typeof getUserNotebookProfile>>>();
  const refreshContentRef =
    useRef<
      (args: { label?: string; notebookPageId: string }) => Promise<void>
    >();
  const applyStateRef = useRef<ApplyState>();
  const calcStateRef = useRef<(id: string) => InitialSchema>();
  const onloadRef = useRef<(id: string) => void>((id) => (delayedLoad = id));
  const onunloadRef = useRef<(id: string) => void>();
  const submit = useSubmit();
  const currentNotebookPageIdRef = useRef("");
  const [newNotebookPageId, setNewNotebookPageId] = useState("");
  useEffect(() => {
    if (data.notebook.app === "SamePage") {
      const settings = {
        uuid: data.notebook.uuid,
        token: data.notebook.token || "",
      };
      const { unload: unloadSamePageClient } = setupSamePageClient({
        app: "SamePage",
        workspace: data.notebook.workspace,
        getSetting: (s) => settings[s],
        setSetting: (s, v) => {
          settings[s] = v;
        },
        addCommand: (cmd) => commands.push(cmd),
        removeCommand: (cmd) =>
          commands.splice(
            commands.findIndex((c) => c.label === cmd.label),
            1
          ),
        renderOverlay: ({ path, id, Overlay, props }) => {
          let onClose = () => {};
          if (Overlay) {
            const el =
              typeof path === "string"
                ? document.querySelector<HTMLElement>(path)
                : path;
            const parent = el || document.createElement("div");
            if (!el) {
              document.body.appendChild(parent);
            }
            const root = createRoot(parent);
            onClose = () => {
              root.unmount();
              if (!el) parent.remove();
            };
            root.render(
              <div id={id}>
                {/** @ts-ignore */}
                <Overlay {...props} onClose={onClose} isOpen={true} />
              </div>
            );
          }
          return onClose;
        },
        onAppLog: (evt) =>
          evt.intent !== "debug" &&
          console.log({
            id: evt.id,
            content: evt.content,
            intent:
              evt.intent === "error"
                ? "danger"
                : evt.intent === "info"
                ? "primary"
                : evt.intent,
          }),
        notificationContainerPath: `.samepage-notifications`,
      });
      const { unload: unloadProtocols, refreshContent } =
        loadSharePageWithNotebook({
          getCurrentNotebookPageId: async () =>
            currentNotebookPageIdRef.current,
          ensurePageByTitle: async (title) => {
            submit({ title: title.content, stay: "true" }, { method: "post" });
            // TODO: need a better way to detect when Remix returns this response. Prob useFetcher
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return title.content;
          },
          openPage: async (title) => {
            submit({ title }, { method: "get" });
            return title;
          },
          deletePage: async (title) => submit({ title }, { method: "delete" }),
          decodeState: async (notebookPageId, state) =>
            applyStateRef.current?.(notebookPageId, state.$body),
          encodeState: async (notebookPageId) => {
            if (!calcStateRef.current) {
              throw new Error(
                `Calculate state wasn't set for page: ${notebookPageId}`
              );
            }
            return { $body: calcStateRef.current(notebookPageId) };
          },
          overlayProps: {
            sharedPageStatusProps: {
              getPaths: (notebookPageId) => {
                const el = document.getElementById("samepage-page-view");
                if (!el) return [];
                const title = el.getAttribute("data-notebook-page-id");
                if (notebookPageId !== title) return [];
                const id = v4();
                const div = document.createElement("div");
                div.setAttribute("data-samepage", id);
                div.classList.add("mt-4");
                document.querySelector("h1")?.appendChild(div);
                return [`h1 div[data-samepage="${id}"]`];
              },
              observer: ({ onload, onunload }) => {
                onloadRef.current = (id) => {
                  currentNotebookPageIdRef.current = id;
                  setTimeout(() => onload(id), 1);
                };
                if (delayedLoad) {
                  onloadRef.current(delayedLoad);
                }
                onunloadRef.current = (id) => setTimeout(() => onunload(id), 1);
                return () => {};
              },
            },
          },
        });
      refreshContentRef.current = refreshContent;
      return () => {
        unloadProtocols();
        unloadSamePageClient();
      };
    }
    return undefined;
  }, []);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "p") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
  return (
    <div className="flex gap-4 h-full items-start relative">
      <div className={"flex gap-8 flex-col h-full max-w-sm"}>
        <div className="flex-grow">
          <b>Shared Pages: </b>
          <ul>
            {data.pages.map((i) => (
              <li key={i.uuid}>
                <Link to={`/user/notebooks/${data.notebook.uuid}/${i.uuid}`}>
                  {i.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-end gap-4">
          {data.notebook.app === "SamePage" && (
            <div className="flex flex-col">
              <TextInput
                name={"title"}
                label={"Title"}
                placeholder={"Title..."}
                value={newNotebookPageId}
                onChange={(e) => setNewNotebookPageId(e.target.value)}
              />
              <Button
                onClick={() => {
                  setNewNotebookPageId("");
                  submit({ title: newNotebookPageId }, { method: "post" });
                }}
              >
                Create Page
              </Button>
            </div>
          )}
          <Button
            type="button"
            onClick={() =>
              window.navigator.clipboard.writeText(
                `${process.env.ORIGIN}/notebook/embeds?auth=${window.btoa(
                  `${data.notebook.uuid}:${data.notebook.token}`
                )}`
              )
            }
          >
            Copy embed
          </Button>
          <Link
            to={"/user/notebooks"}
            className={"text-sky-500 underline py-3"}
          >
            Back
          </Link>
        </div>
      </div>
      <div className="flex-grow h-full">
        <Outlet
          context={{
            applyStateRef,
            calcStateRef,
            refreshContentRef,
            onloadRef,
            onunloadRef,
          }}
        />
      </div>
      <div className="absolute top-4 right-4 samepage-notifications" />
      <Dialog
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        title={"Command Palette"}
      >
        {commands.map((c) => (
          <div
            key={c.label}
            className={"border-b border-b-slate-800 cursor-pointer"}
            onClick={() => {
              c.callback();
              setCommandPaletteOpen(false);
            }}
          >
            {c.label}
          </div>
        ))}
      </Dialog>
    </div>
  );
};

const zNotebookDatabase = z.object({
  pages: z
    .object({
      notebookPageId: z.string(),
      pageUuid: z.string(),
    })
    .array()
    .optional()
    .default([]),
});

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, async ({ context, params, searchParams }) => {
    const uuid = params["uuid"] || "";
    const notebookPageId = searchParams["title"] || "";
    if (notebookPageId) {
      const Key = `data/notebooks/${uuid}.json`;
      const content = await downloadFileContent({
        Key,
      });
      const { pages } = zNotebookDatabase.parse(JSON.parse(content || "{}"));
      const pageUuid = pages.find(
        (p) => p.notebookPageId === notebookPageId
      )?.pageUuid;
      if (!pageUuid) {
        throw new NotFoundResponse(
          `Notebook ${uuid} not connected to page ${notebookPageId}`
        );
      }
      return redirect(`/user/notebooks/${uuid}/${pageUuid}`);
    }
    return getUserNotebookProfile({ context, params });
  });
};

export const action: ActionFunction = (args) => {
  return remixAppAction(args, {
    POST: async ({ data, params }) => {
      const uuid = params["uuid"] || "";
      const notebookPageId = data["title"]?.[0] || "";
      const Key = `data/notebooks/${uuid}.json`;
      const content = await downloadFileContent({
        Key,
      });
      const contentJson = JSON.parse(content || "{}");
      const pageUuid = v4();
      const Body = JSON.stringify({
        ...contentJson,
        pages: [...(contentJson.pages || []), { notebookPageId, pageUuid }],
      });
      await uploadFile({ Key, Body });
      return data["stay"]
        ? { success: true }
        : redirect(`/user/notebooks/${uuid}/${pageUuid}`);
    },
    DELETE: async ({ params, data }) => {
      const uuid = params["uuid"] || "";
      const notebookPageId = data["title"]?.[0] || "";
      const Key = `data/notebooks/${uuid}.json`;
      const content = await downloadFileContent({
        Key,
      });
      const contentJson = JSON.parse(content || "{}");
      const Body = JSON.stringify({
        ...contentJson,
        pages: (contentJson.pages || []).filter(
          (p: { notebookPageId: string }) => p.notebookPageId !== notebookPageId
        ),
      });
      await uploadFile({ Key, Body });
      return redirect(`/user/notebooks/${uuid}`);
    },
  });
};

const Title = () => {
  const matches = useMatches();
  const data = matches[3].data as Awaited<
    ReturnType<typeof getUserNotebookProfile>
  >;
  return data ? (
    <span className="normal-case">
      {data.notebook.app} / {data.notebook.workspace}
    </span>
  ) : (
    "Notebook"
  );
};

export const handle = { Title };

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: blueprintcss },
    { rel: "stylesheet", href: blueprinticonscss },
  ];
};

export default SingleNotebookPage;
