import { ActionFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import remixAdminAction from "~/data/remixAdminAction.server";
import Button from "package/components/Button";
import Switch from "~/components/Switch";
import deleteSharedPage from "~/data/deleteSharedPage.server";
import disconnectNotebookFromPage from "~/data/disconnectNotebookFromPage.server";
import getSharedPageByUuid from "~/data/getSharedPageByUuid.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { useState } from "react";
import AtJsonRendered from "package/components/AtJsonRendered";
import TextInput from "package/components/TextInput";
import Select from "~/components/Select";
import inviteNotebookToPage from "~/data/inviteNotebookToPage.server";
import getNotebookUuids from "~/data/getNotebookUuids.server";
import BaseInput from "package/components/BaseInput";
import { z } from "zod";
import listApps from "~/data/listApps.server";
import { downloadFileContent } from "~/data/downloadFile.server";
import ExternalLink from "~/components/ExternalLink";

const SinglePagePage = () => {
  const loaderData = useLoaderData<typeof loadData>();
  const { notebooks, pages, actors, apps, uuid } = loaderData;
  const { state, history } = pages[uuid] || {
    data: { content: "", annotations: [] },
    history: [],
  };
  const chosenNotebook = notebooks.find((n) => n.linkUuid === uuid);
  const [isData, setIsData] = useState(false);
  return (
    <div className={"flex flex-col gap-12 h-full"}>
      <div className={"flex gap-8 flex-grow-1"}>
        <div className="bg-gray-200 flex flex-col-reverse text-gray-800 max-w-xs w-full border border-gray-800 overflow-auto justify-end flex-shrink-0">
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
        <div className="flex-grow border-gray-800 flex flex-col h-full overflow-hidden">
          <h1 className={"text-3xl py-4 flex items-center justify-between"}>
            <span className="opacity-75 text-xl italic">
              Showing data from {chosenNotebook?.app || "Unknown"} /{" "}
              {chosenNotebook?.workspace || "Unknown"}
            </span>
            <ExternalLink
              href={`https://s3.console.aws.amazon.com/s3/object/samepage.network?region=us-east-1&prefix=data/ipfs/${chosenNotebook?.cid}`}
              className="text-sm text-sky-400 underline bg-sky-50 rounded-sm px-2 py-1"
            >
              {/* {TODO - Download directly} */}
              Download From S3
            </ExternalLink>
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
              {JSON.stringify(state, null, 4)}
            </pre>
          ) : (
            <div>
              <AtJsonRendered {...state} />
            </div>
          )}
        </div>
      </div>
      <h1 className={"py-4 text-3xl"}>Notebooks</h1>
      <ul className="list-disc max-w-lg">
        {notebooks.map((l) => (
          <li
            key={l.linkUuid}
            className={`p-2 ${
              l.linkUuid === chosenNotebook?.linkUuid ? "bg-gray-200" : ""
            }`}
          >
            <div className={"flex items-center w-full justify-between"}>
              <Link
                to={`/admin/pages/${l.linkUuid}`}
                className={"cursor-pointer"}
              >
                {l.app} / {l.workspace} / {l.notebookPageId}
                {l.open ? " (PENDING)" : ""}
              </Link>
              <Form method={"delete"}>
                <Button
                  name={"link"}
                  value={l.linkUuid}
                  className={"rounded-md px-2 text-sm uppercase"}
                  intent={"warning"}
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
            value={chosenNotebook?.uuid}
            name={"notebookUuid"}
          />
          <BaseInput
            type={"hidden"}
            value={chosenNotebook?.notebookPageId}
            name={"notebookPageId"}
          />
          <Select name={"app"} options={apps} />
          <TextInput name={"workspace"} placeholder={"workspace"} />
          <Button>Invite</Button>
        </Form>
        <Form method={"delete"}>
          <Button intent="danger">Delete</Button>
        </Form>
      </div>
    </div>
  );
};

const loadData = async ({
  requestId,
  uuid,
}: {
  requestId: string;
  uuid: string;
}) => {
  const apps = await listApps({ requestId });
  const data = await getSharedPageByUuid(uuid, requestId);
  return {
    ...data,
    uuid,
    apps: apps.map((a) => ({ id: a.code, label: a.name })),
  };
};

export const loader = (args: LoaderArgs) => {
  return remixAdminLoader(args, async ({ params, context, searchParams }) => {
    const uuid = params["uuid"] || "";
    // TODO - fix direct download
    if (searchParams["download"]) {
      const uuid = params["uuid"] || "";
      const data = await downloadFileContent({ Key: `data/pages/${uuid}` });
      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${uuid}.json"`,
        },
      });
    }
    return loadData({ requestId: context.requestId, uuid });
  });
};

export const action: ActionFunction = async (args) => {
  return remixAdminAction(args, {
    DELETE: ({ params, data, context: { requestId } }) => {
      const link = data["link"]?.[0];
      const uuid = params["uuid"] || "";
      return (
        typeof link === "string"
          ? disconnectNotebookFromPage({ uuid: link, requestId })
          : deleteSharedPage(uuid, requestId)
      ).then(() => redirect("/admin/pages"));
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
