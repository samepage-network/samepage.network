import AtJsonRendered from "package/components/AtJsonRendered";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import Automerge from "automerge";
import { Schema, InitialSchema } from "package/types";
import Button from "@dvargas92495/app/components/Button";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const ViewCidPage = () => {
  const data = useLoaderData<InitialSchema & { parent: string | null }>();
  return (
    <div className="flex flex-col gap-2 h-full justify-between">
      <div className="flex-grow border border-opacity-50 border-gray-300">
        <AtJsonRendered {...data} />
      </div>
      {data.parent && (
        <Link className="flex-shrink" to={`/view/${data.parent}`}>
          <Button>Go to parent</Button>
        </Link>
      )}
    </div>
  );
};

export const loader: LoaderFunction = ({ params }) => {
  const cid = params["cid"];
  if (!cid) {
    return { content: new Automerge.Text(""), annotations: [], parent: null };
  }
  return downloadSharedPage({ cid }).then((memo) => {
    const doc = Automerge.load<Schema>(memo.body);
    return {
      parent: memo.parent?.toString() || null,
      content: doc.content.toString(),
      annotations: doc.annotations,
    };
  });
};

export default ViewCidPage;
