import SharedPageStatus from "client/src/components/SharedPageStatus";
import setupSharePageWithNotebook from "client/src/protocols/sharePageWithNotebook";
import { useState, useMemo } from "react";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import type Automerge from "automerge";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import Select from "@dvargas92495/app/components/Select";
import listPageNotebookLinks from "~/data/listPageNotebookLinks.server";

const SharedPageStatusPage = () => {
  const { pages } = useLoaderData<{ pages: string[] }>();
  const { listConnectedNotebooks, getLocalHistory } = useMemo(() => {
    return setupSharePageWithNotebook({
      loadState: (notebookPageId) =>
        fetch(
          `/admin/components/shared-page-status?uuid=${notebookPageId}&_data=routes%2F__private%2Fadmin%2Fcomponents%2Fshared-page-status`
        )
          .then((r) => r.json())
          .then((r) => {
            return new Uint8Array(
              window
                .atob(r.state)
                .split("")
                .map((c) => c.charCodeAt(0))
            ) as Automerge.BinaryDocument;
          }),
    });
  }, []);
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
        notebookPageId={notebookPageId}
        listConnectedNotebooks={listConnectedNotebooks}
        getLocalHistory={getLocalHistory}
      />
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId } }) => {
    const uuid = new URL(args.request.url).searchParams.get("uuid");
    return uuid
      ? downloadSharedPage(uuid).then((r) => ({
          state: Buffer.from(r).toString("base64"),
        }))
      : listPageNotebookLinks(requestId).then(({ pages }) => ({
          pages: Object.keys(pages),
        }));
  });
};

export default SharedPageStatusPage;
