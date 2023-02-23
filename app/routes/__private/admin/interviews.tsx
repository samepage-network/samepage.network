import { LoaderFunction } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import remixAdminAction from "~/data/remixAdminAction.server";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import listUserInterviewCandidates from "~/data/listUserInterviewCandidates.server";
import emailUserInterviewCandidate from "~/data/emailUserInterviewCandidate.server";
import Button from "~/components/Button";
import BaseInput from "~/components/BaseInput";

const AdminInterviewsPage = () => {
  const data =
    useLoaderData<Awaited<ReturnType<typeof listUserInterviewCandidates>>>();
  return (
    <ul className="list-disc pl-4">
      {data.users.map((user) => (
        <li className="py-4" key={user.email}>
          <div className="flex justify-between">
            <span>
              {user.email} was invited on{" "}
              {new Date(user.invited).toLocaleString()} and last used SamePage
              on {new Date(user.msg).toLocaleString()}
            </span>
            <Form method="post">
              <BaseInput type={"hidden"} value={user.email} />
              <Button>Email</Button>
            </Form>
          </div>
        </li>
      ))}
    </ul>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, listUserInterviewCandidates);
};

export const action: LoaderFunction = (args) => {
  return remixAdminAction(args, emailUserInterviewCandidate);
};

export default AdminInterviewsPage;
