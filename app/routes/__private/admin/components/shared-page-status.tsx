import SharedPageStatus from "client/src/components/SharedPageStatus";
import setupSharePageWithNotebook from "client/src/protocols/sharePageWithNotebook";
import { useMemo } from "react";
import type { LoaderFunction } from "@remix-run/node";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import type Automerge from "automerge";

const SharedPageStatusPage = () => {
  const { listConnectedNotebooks, getLocalHistory } = useMemo(
    () =>
      setupSharePageWithNotebook({
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
      }),
    []
  );
  return (
    <>
      <div className={"mb-8"}>
        <i>Component is still under development...</i>
      </div>
      <SharedPageStatus
        notebookPageId="babd1097-a2d3-4a01-b641-b3fae244fbde"
        listConnectedNotebooks={listConnectedNotebooks}
        getLocalHistory={getLocalHistory}
      />
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  const uuid = new URL(args.request.url).searchParams.get("uuid");
  return uuid
    ? downloadSharedPage(uuid).then((r) => ({
        state: Buffer.from(r).toString("base64"),
      }))
    : { state: "" };
};

export default SharedPageStatusPage;
