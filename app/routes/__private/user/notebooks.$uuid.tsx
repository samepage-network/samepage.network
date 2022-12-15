export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import remixAppAction from "@dvargas92495/app/backend/remixAppAction.server";
import remixAppLoader from "@dvargas92495/app/backend/remixAppLoader.server";
import Button from "@dvargas92495/app/components/Button";
import TextInput from "@dvargas92495/app/components/TextInput";
import { ActionFunction, LoaderFunction } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  Form,
  Outlet,
  useMatches,
} from "@remix-run/react";
import getUserNotebookProfile from "~/data/getUserNotebookProfile.server";
import { useEffect, useRef } from "react";
import setupSamePageClient from "package/protocols/setupSamePageClient";
import { AddCommand } from "package/internal/types";
import loadSharePageWithNotebook from "package/protocols/sharePageWithNotebook";
import ReactDOM from "react-dom";

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
  useEffect(() => {
    if (data.notebook.app === "SamePage") {
      const settings = { uuid: data.notebook.uuid, token: data.notebook.token };
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
        renderOverlay: ({ path = document.body, id, Overlay, props }) => {
          let onClose = () => {};
          if (Overlay) {
            const parent =
              typeof path === "string"
                ? document.querySelector<HTMLElement>(path) || document.body
                : path === null
                ? document.body
                : path;
            ReactDOM.createPortal(
              <div id={id}>
                {/** @ts-ignore */}
                <Overlay {...props} onClose={onClose} isOpen={true} />
              </div>,
              parent
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
          createPage: async (title) =>
            `form.submit(${title}, {method: "post"})`,
          openPage: async (title) => `navigate(${title})`,
          deletePage: async (title) =>
            `form.submit(${title}, {method: "delete"})`,
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
                return ["h1", notebookPageId];
              },
              observer: ({ onload, onunload }) => {
                onload("notebookPageId");
                return () => onunload("notebookPageId");
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
  }, [data.notebook.app, data.notebook.workspace]);
  return (
    <div className="flex gap-4 h-full items-start relative">
      <div className={"flex gap-4 flex-col h-full max-w-sm"}>
        <div>
          <code>{data.notebook.uuid}</code>
        </div>
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
      <div>
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
  return remixAppAction(args, {});
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
    JSON.stringify(matches[3])
  );
};

export const handle = { Title };

export default SingleNotebookPage;
