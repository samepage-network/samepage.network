import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import remixAdminAction from "~/data/remixAdminAction.server";
import Button from "~/components/Button";
import Switch from "~/components/Switch";
import deleteSharedPage from "~/data/deleteSharedPage.server";
import disconnectNotebookFromPage from "~/data/disconnectNotebookFromPage.server";
import getSharedPageByUuid from "~/data/getSharedPageByUuid.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { useState } from "react";
import AtJsonRendered from "package/components/AtJsonRendered";
import TextInput from "~/components/TextInput";
import Select from "~/components/Select";
import inviteNotebookToPage from "~/data/inviteNotebookToPage.server";
import getNotebookUuids from "~/data/getNotebookUuids.server";
import BaseInput from "~/components/BaseInput";
import { z } from "zod";
import listApps from "~/data/listApps.server";

const SinglePagePage = () => {
  const { notebooks, pages, apps, actors } = useLoaderData<
    Awaited<ReturnType<typeof getSharedPageByUuid>> & {
      apps: { id: string; label: string }[];
    }
  >();
  const [chosenNotebook, setChosenNotebook] = useState(0);
  const { data, history } = pages[notebooks[chosenNotebook]?.cid] || {
    data: { content: "", annotations: [] },
    history: [],
  };
  const [isData, setIsData] = useState(false);
  return (
    <div className={"flex flex-col gap-12 h-full"}>
      <div className={"flex gap-8 flex-grow-1"}>
        <div className="bg-gray-200 flex flex-col-reverse text-gray-800 max-w-sm w-full border border-gray-800 overflow-auto justify-end">
          {history.map((l, index) => (
            <div
              key={index}
              className={"border-t border-t-gray-800 p-4 relative"}
            >
              <div className={"text-sm absolute top-2 right-2"}>{index}</div>
              <div>
                <span className={"font-bold"}>Action: </span>
                <span>{l.change.message}</span>
              </div>
              <div>
                <span className={"font-bold"}>Actor: </span>
                <span>
                  {actors[l.change.actor].appName}/
                  {actors[l.change.actor].workspace}
                </span>
              </div>
              <div>
                <span className={"font-bold"}>Date: </span>
                <span>{new Date(l.change.time * 1000).toLocaleString()}</span>
              </div>
            </div>
          ))}
          <h1 className="text-3xl p-4">Log</h1>
        </div>
        <div className="flex-grow border-gray-800 flex flex-col h-full">
          <h1 className={"text-3xl py-4 flex items-center justify-between"}>
            <span className="opacity-75 text-xl italic">
              Showing data from {notebooks[chosenNotebook]?.app || "Unknown"} /{" "}
              {notebooks[chosenNotebook]?.workspace || "Unknown"}
            </span>
            <Switch
              onChange={setIsData}
              label={"Show Raw Data"}
              labelClassname={"w-28 text-xs"}
              className={"inline-block mb-0"}
            />
          </h1>
          {isData ? (
            <pre
              className={"overflow-auto whitespace-pre-wrap flex-grow h-full"}
            >
              {JSON.stringify(data, null, 4)}
            </pre>
          ) : (
            <div>
              <AtJsonRendered {...data} />
            </div>
          )}
        </div>
      </div>
      <h1 className={"py-4 text-3xl"}>Notebooks</h1>
      <ul className="list-disc max-w-lg">
        {notebooks.map((l, index) => (
          <li
            key={l.uuid}
            className={`p-2 ${index === chosenNotebook ? "bg-gray-200" : ""}`}
          >
            <div className={"flex items-center w-full justify-between"}>
              <span
                onClick={() => setChosenNotebook(index)}
                className={"cursor-pointer"}
              >
                {l.app} / {l.workspace} / {l.notebookPageId}
                {l.open ? " (PENDING)" : ""}
              </span>
              <Form method={"delete"}>
                <Button
                  name={"link"}
                  value={l.uuid}
                  className={
                    "rounded-md px-2 text-sm uppercase bg-yellow-500 hover:bg-yellow-700 active:bg-yellow-800 disabled:bg-yellow-500"
                  }
                >
                  Disconnect
                </Button>
              </Form>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-8">
        <Form className="flex items-center gap-8" method="post">
          <BaseInput
            type={"hidden"}
            value={notebooks[chosenNotebook]?.uuid}
            name={"notebookUuid"}
          />
          <BaseInput
            type={"hidden"}
            value={notebooks[chosenNotebook]?.notebookPageId}
            name={"notebookPageId"}
          />
          <Select name={"app"} options={apps} />
          <TextInput name={"workspace"} placeholder={"workspace"} />
          <Button>Invite</Button>
        </Form>
        <Form method={"delete"}>
          <Button className="bg-red-500 hover:bg-red-700 active:bg-red-800 disabled:bg-red-500">
            Delete
          </Button>
        </Form>
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, async ({ params, context }) => {
    const apps = await listApps({ requestId: context.requestId });
    const data = await getSharedPageByUuid(
      params["uuid"] || "",
      context.requestId
    );
    return {
      ...data,
      apps: apps.map((a) => ({ id: a.code, label: a.name })),
    };
  });
};

export const action: ActionFunction = async (args) => {
  return remixAdminAction(args, {
    DELETE: ({ params, data, context: { requestId } }) => {
      const link = data["link"];
      const uuid = params["uuid"] || "";
      return typeof link === "string"
        ? disconnectNotebookFromPage({ uuid: link, requestId })
        : deleteSharedPage(uuid, requestId).then(() =>
            redirect("/admin/pages")
          );
    },
    POST: async ({ context: { requestId }, data, params }) => {
      const { app, workspace, notebookPageId, notebookUuid } = z
        .object({
          notebookUuid: z.string(),
          notebookPageId: z.string(),
          app: z.string(),
          workspace: z.string(),
        })
        .parse(
          Object.fromEntries(Object.entries(data).map(([k, [v]]) => [k, v]))
        );
      const [targetNotebookUuid] = await getNotebookUuids({
        requestId,
        app,
        workspace,
      });
      const pageUuid = params["uuid"] || "";
      return inviteNotebookToPage({
        requestId,
        pageUuid,
        targetNotebookUuid,
        notebookPageId,
        notebookUuid,
      });
    },
  });
};

export default SinglePagePage;
