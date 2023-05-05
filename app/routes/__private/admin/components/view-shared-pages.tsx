import { useState } from "react";
import ViewSharedPages from "package/components/ViewSharedPages";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import Button from "package/components/Button";
import listPages from "~/data/listPages.server";
import listSharedPages from "~/data/listSharedPages.server";

const ViewSharedPagesPage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { pages } =
    useLoaderData<Awaited<ReturnType<typeof listSharedPages>>>();
  return (
    <>
      <Button type={"button"} onClick={() => setIsOpen(true)}>
        View Shared Pages
      </Button>
      <ViewSharedPages
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        pages={pages}
        onLinkClick={(id) => window.alert(id)}
      />
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId } }) => {
    return listPages({ requestId });
  });
};

export default ViewSharedPagesPage;
