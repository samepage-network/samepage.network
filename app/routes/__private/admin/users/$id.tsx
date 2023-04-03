export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import { LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import getUserProfile from "~/data/getUserProfile.server";

const SingleUserPage = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof getUserProfile>>>();
  return (
    <div className={"flex gap-4 flex-col h-full"}>
      <div>
        <code>{data.user.id}</code>
      </div>
      <div>
        <b>Plan: </b>
        <span>{data.user.plan}</span>
      </div>
      <div>
        Notebooks
        <ul className=" list-disc pl-8">
          {data.notebooks.map((n) => (
            <li key={n.uuid}>
              <div>
                <b>App: </b>
                <span>{n.app}</span>
              </div>
              <div>
                <b>Workspace: </b>
                <span>{n.workspace}</span>
              </div>
              <div>
                <Link
                  to={`/admin/notebooks/${n.uuid}`}
                  className={"text-sky-400"}
                >
                  Link
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, getUserProfile);
};

export default SingleUserPage;
