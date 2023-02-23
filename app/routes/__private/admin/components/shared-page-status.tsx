import SharedPageStatus from "package/components/SharedPageStatus";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useMemo, useEffect } from "react";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import Select from "~/components/Select";
import listPages from "~/data/listPages.server";
import remixAdminAction from "~/data/remixAdminAction.server";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { getSetting } from "package/internal/registry";
import { set } from "package/utils/localAutomergeDb";

const SharedPageStatusPage = () => {
  const { pages } = useLoaderData<Awaited<ReturnType<typeof listPages>>>();
  const navigate = useNavigate();
  const filtered = useMemo(
    () => pages.filter((p) => p.notebook_uuid === getSetting("uuid")),
    [pages]
  );
  const notebookPageIds = useMemo(
    () => filtered.map((f) => f.notebook_page_id),
    [pages]
  );
  const [notebookPageId, setNotebookPageId] = useState<string>();
  useEffect(() => {
    if (notebookPageId) set(notebookPageId);
  }, [notebookPageId]);
  return (
    <>
      <div className={"mb-8"}>
        <Select
          label="Page"
          options={notebookPageIds}
          onChange={(e) => setNotebookPageId(e as string)}
          defaultValue={getSetting("uuid")}
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
    return listPages({ requestId });
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
