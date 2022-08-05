import { LoaderFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import remixAppLoader from "@dvargas92495/app/backend/remixAppLoader.server";
import listPageNotebookLinks from "~/data/listPageNotebookLinks.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const AdminPagesPage = () => {
  const { pages } =
    useLoaderData<Awaited<ReturnType<typeof listPageNotebookLinks>>>();
  return (
    <div className="grid grid-cols-4 gap-4">
      {Object.entries(pages).map(([uuid, links]) => (
        <div className="rounded-lg shadow-lg bg-slate-300 p-4" key={uuid}>
          <Link to={uuid}>
            <h1 className="font-bold text-lg">{uuid}</h1>
          </Link>
          <ul className="pt-4 ml-4 list-disc">
            {links.map((l) => (
              <li key={l.uuid}>
                {l.app}/{l.workspace}/{l.id}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  // TODO: replace with remixAdminLoader
  return remixAppLoader(args, listPageNotebookLinks);
};

export default AdminPagesPage;
