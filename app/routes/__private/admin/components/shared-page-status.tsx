import SharedPageStatus from "package/components/SharedPageStatus";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import Select from "@dvargas92495/app/components/Select";
import listPageNotebookLinks from "~/data/listAllPageNotebookLinks.server";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import getMysql from "fuegojs/utils/mysql";
import type Automerge from "automerge";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const SharedPageStatusPage = () => {
  const { pages } = useLoaderData<{ pages: string[] }>();
  const navigate = useNavigate();
  const [notebookPageId, setNotebookPageId] = useState(pages[0]);
  return (
    <>
      <div className={"mb-8"}>
        <Select
          label="Page"
          options={pages}
          onChange={(e) => setNotebookPageId(e as string)}
          defaultValue={pages[0]}
        />
      </div>
      <SharedPageStatus
        key={notebookPageId}
        onClose={() => navigate("/admin/components")}
        isOpen={true}
        notebookPageId={notebookPageId}
        loadState={(notebookPageId) =>
          fetch(
            `/admin/components/shared-page-status?notebookPageId=${notebookPageId}&_data=routes%2Fadmin%2Fcomponents%2Fshared-page-status`
          )
            .then((r) => r.json())
            .then((r) => {
              return new Uint8Array(
                window
                  .atob(r.state)
                  .split("")
                  .map((c) => c.charCodeAt(0))
              ) as Automerge.BinaryDocument;
            })
        }
      />
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId }, searchParams }) => {
    const notebookPageId = searchParams["notebookPageId"];
    return notebookPageId
      ? getMysql()
          .then((cxn) =>
            cxn
              .execute(
                "SELECT cid FROM page_notebook_links WHERE notebook_page_id=? LIMIT 1",
                [notebookPageId]
              )
              .then(([r]) => {
                cxn.destroy();
                return (r as { cid: string }[])[0]?.cid;
              })
          )
          .then((cid) => downloadSharedPage({ cid }))
          .then((r) => ({
            state: Buffer.from(r.body).toString("base64"),
          }))
      : listPageNotebookLinks(requestId).then(({ pages }) => ({
          pages: Object.keys(pages),
        }));
  });
};

export const action: ActionFunction = (args) => {
  return remixAdminAction(args, {
    POST: async ({ searchParams }) => {
      const uuid = searchParams["uuid"];
      const state = await args.request.text();
      return { uuid, state };
    },
  });
};

export default SharedPageStatusPage;
