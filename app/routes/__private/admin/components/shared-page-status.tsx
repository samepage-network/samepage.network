import SharedPageStatus from "package/components/SharedPageStatus";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useMemo } from "react";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import Select from "@dvargas92495/app/components/Select";
import listPageNotebookLinks from "~/data/listAllPageNotebookLinks.server";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import { getSetting } from "package/internal/registry";

const SharedPageStatusPage = () => {
  const { pages } =
    useLoaderData<Awaited<ReturnType<typeof listPageNotebookLinks>>>();
  const navigate = useNavigate();
  const filtered = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(pages).filter(([_uuid, ps]) =>
          ps.some((p) => p.notebook === getSetting("uuid") && !p.inviteOpen)
        )
      ),
    [pages]
  );
  const notebookPageIds = useMemo(
    () =>
      Object.keys(filtered).map(
        (k) =>
          filtered[k].find((n) => n.notebook === getSetting("uuid"))?.id || ""
      ),
    [pages]
  );
  const [notebookPageId, setNotebookPageId] = useState<string>();
  return (
    <>
      <div className={"mb-8"}>
        <Select
          label="Page"
          options={notebookPageIds}
          onChange={(e) => setNotebookPageId(e as string)}
          defaultValue={""}
        />
      </div>
      <SharedPageStatus
        key={notebookPageId}
        onClose={() => navigate("/admin/components")}
        isOpen={true}
        notebookPageId={notebookPageId || ""}
      />
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId } }) => {
    return listPageNotebookLinks(requestId).then(({ pages }) => ({
      pages,
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
