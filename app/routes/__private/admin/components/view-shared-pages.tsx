import { useState } from "react";
import ViewSharedPages from "package/src/components/ViewSharedPages";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import listPageNotebookLinks from "~/data/listPageNotebookLinks.server";
import Button from "@dvargas92495/app/components/Button";

const ViewSharedPagesPage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { pages } = useLoaderData<{ pages: string[] }>();
  return (
    <>
      <Button type={"button"} onClick={() => setIsOpen(true)}>
        View Shared Pages
      </Button>
      <ViewSharedPages
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        notebookPageIds={pages}
      />
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId } }) => {
    return listPageNotebookLinks(requestId).then(({ pages }) => ({
      pages: Object.keys(pages),
    }));
  });
};

export default ViewSharedPagesPage;
