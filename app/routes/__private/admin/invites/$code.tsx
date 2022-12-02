export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import Button from "@dvargas92495/app/components/Button";
import TextInput from "@dvargas92495/app/components/TextInput";
import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Form, useLoaderData, Link } from "@remix-run/react";
import getInviteInfo from "~/data/getInviteInfo.server";
import updateInviteInfo from "~/data/updateInviteInfo.server";
import deleteInvite from "~/data/deleteInvite.server";

const SingleInvitePage = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof getInviteInfo>>>();
  return (
    <div className={"flex gap-4 flex-col h-full"}>
      <div>
        <code>
          {data.code} ({data.links} tokens)
        </code>
      </div>
      {data.notebooks.map((n) => (
        <Link key={n.uuid} to={`/admin/notebooks/${n.uuid}`}>
          <div>
            <b>App: </b>
            <span>{n.app}</span>
          </div>
          <div>
            <b>Workspace: </b>
            <span>{n.workspace}</span>
          </div>
        </Link>
      ))}
      <Form method={"put"} className={"flex items-center gap-8"}>
        <TextInput
          name="email"
          label={"Email"}
          className={"flex-grow"}
          defaultValue={data.email}
        />
        <Button>Update</Button>
      </Form>
      <Form method={"delete"}>
        <Button className="bg-red-400">Delete</Button>
      </Form>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, getInviteInfo);
};

export const action: ActionFunction = (args) => {
  return remixAdminAction(args, {
    DELETE: ({ params, context: { requestId } }) =>
      deleteInvite({
        code: params["code"] || "",
        requestId,
      }).then(() => redirect("/admin/invites")),
    PUT: ({ params, context: { requestId }, data }) =>
      updateInviteInfo({
        code: params["code"] || "",
        requestId,
        email: data["email"][0] || "",
      }),
  });
};

export default SingleInvitePage;
