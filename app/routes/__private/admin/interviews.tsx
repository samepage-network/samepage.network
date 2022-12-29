import { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import listUserInterviewCandidates from "~/data/listUserInterviewCandidates.server";

const AdminInterviewsPage = () => {
  const data =
    useLoaderData<Awaited<ReturnType<typeof listUserInterviewCandidates>>>();
  return (
    <ul className="list-disc pl-4">
      {data.users.map((user) => (
        <li className="py-4" key={user.email}>
          {user.email} was invited on {new Date(user.invited).toLocaleString()}{" "}
          and last used SamePage on {new Date(user.msg).toLocaleString()}
        </li>
      ))}
    </ul>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, listUserInterviewCandidates);
};

export default AdminInterviewsPage;
