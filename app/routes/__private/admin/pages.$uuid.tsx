import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
import Button from "@dvargas92495/app/components/Button";
import deleteSharedPage from "~/data/deleteSharedPage.server";
import disconnectNotebookFromPage from "~/data/disconnectNotebookFromPage.server";
import getSharedPageByUuid from "~/data/getSharedPageByUuid.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import { v4 } from "uuid";
import { appNameById } from "@samepage/shared";

const parseActorId = (s: string) =>
  s
    .split("")
    .map((c, i, a) =>
      i % 2 === 0 ? String.fromCharCode(parseInt(c + a[i + 1], 16)) : ""
    )
    .join("")
    .replace(/^\d+\//, (val) => `${appNameById[val.slice(0, -1)]}/`);

const SinglePagePage = () => {
  const { data, notebooks, history } =
    useLoaderData<Awaited<ReturnType<typeof getSharedPageByUuid>>>();
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
                <span>{parseActorId(l.change.actor)}</span>
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
          <h1 className={"text-3xl py-4"}>State</h1>
          <pre className={"overflow-auto whitespace-pre-wrap flex-grow h-full"}>
            {JSON.stringify(data, null, 4)}
          </pre>
        </div>
      </div>
      <h1 className={"py-4 text-3xl"}>Notebooks</h1>
      <ul className="ml-4 list-disc max-w-lg">
        {notebooks.map((l) => (
          <li key={l.uuid}>
            <div className={"flex items-center w-full justify-between mb-2"}>
              <span>
                {appNameById[l.app]} / {l.workspace} / {l.notebook_page_id}
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
      <Form method={"delete"}>
        <Button className="bg-red-500 hover:bg-red-700 active:bg-red-800 disabled:bg-red-500">
          Delete
        </Button>
      </Form>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  // return remixAdminLoader(args, ({ params }) =>
  return getSharedPageByUuid(
    args.params["uuid"] || "",
    args.context?.lambdaContext?.requestId || v4()
  );
  // );
};

export const action: ActionFunction = async (args) => {
  // return remixAdminAction(args, {
  //   DELETE: ({ params }) =>
  const data = await args.request.formData();
  const link = data.get("link");
  const uuid = args.params["uuid"] || "";
  const requestId = args.context?.lambdaContext?.requestId || v4();
  return typeof link === "string"
    ? disconnectNotebookFromPage({ uuid: link, requestId })
    : deleteSharedPage(uuid, requestId).then(() => redirect("/admin/pages"));
  // });
};

export default SinglePagePage;
