export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import remixAppAction from "@dvargas92495/app/backend/remixAppAction.server";
import remixAppLoader from "@dvargas92495/app/backend/remixAppLoader.server";
import Button from "@dvargas92495/app/components/Button";
import TextInput from "@dvargas92495/app/components/TextInput";
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
  Form,
  Outlet,
  useMatches,
  useSubmit,
} from "@remix-run/react";
import getUserNotebookProfile from "~/data/getUserNotebookProfile.server";
import { useEffect, useRef } from "react";
import setupSamePageClient from "package/protocols/setupSamePageClient";
import { AddCommand } from "package/internal/types";
import loadSharePageWithNotebook from "package/protocols/sharePageWithNotebook";
import { createRoot } from "react-dom/client";
import getPageUuidByNotebook from "~/data/getPageUuidByNotebook.server";
import { v4 } from "uuid";

const Back = () => (
  <Link to={"/user/notebooks"} className={"text-sky-500 underline"}>
    Back
  </Link>
);

const commands: Parameters<AddCommand>[0][] = [];

const SingleNotebookPage = () => {
  const data =
    useLoaderData<Awaited<ReturnType<typeof getUserNotebookProfile>>>();
  const refreshContentRef =
    useRef<
      (args: {
        label?: string;
        notebookPageId: string;
      }) => Promise<Record<string, unknown>>
    >();
  const submit = useSubmit();
  useEffect(
    () => {
      if (data.notebook.app === "SamePage") {
        const settings = {
          uuid: data.notebook.uuid,
          token: data.notebook.token,
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
            getCurrentNotebookPageId: async () => "useMatches",
            createPage: async (title) => {
              submit({ title }, { method: "post" });
            },
            openPage: async (title) => `navigate(${title})`,
            deletePage: async (title) =>
              submit({ title }, { method: "delete" }),
            doesPageExist: async (notebookPageId) =>
              data.pages.some((p) => p.title === notebookPageId),
            applyState: async () => `notebookPageId, setState(state)`,
            calculateState: async () => ({
              content: `getState(notebookPageId)`,
              annotations: [],
            }),
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
                  const pageChange = ((e: CustomEvent) => {
                    onload(e.detail);
                  }) as EventListener;
                  const pageRemove = ((e: CustomEvent) => {
                    onunload(e.detail);
                  }) as EventListener;
                  window.addEventListener("page-change", pageChange);
                  window.addEventListener("page-remove", pageRemove);
                  return () => {
                    window.removeEventListener("page-change", pageChange);
                    window.removeEventListener("page-remove", pageRemove);
                  };
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
    },
    Object.entries(data.notebook)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((a) => a[1])
  );
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
        {data.notebook.app === "SamePage" ? (
          <Form method="post">
            <TextInput name={"id"} label={"Title"} placeholder={"Title..."} />
            <div className="flex items-center gap-4">
              <Button>Create Page</Button>
              <Back />
            </div>
          </Form>
        ) : (
          <Back />
        )}
      </div>
      <div className="flex-grow h-full">
        <Outlet />
      </div>
      <div className="absolute top-4 right-4 samepage-notifications" />
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, getUserNotebookProfile);
};

export const action: ActionFunction = (args) => {
  return remixAppAction(args, {
    POST: ({ data, params, context: { requestId } }) => {
      const uuid = params["uuid"] || "";
      return getPageUuidByNotebook({
        uuid,
        notebookPageId: data["title"]?.[0] || "",
        requestId,
      }).then(({ pageUuid }) =>
        redirect(`/user/notebooks/${uuid}/${pageUuid}`)
      );
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
