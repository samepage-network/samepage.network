export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
// import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
import Button from "@dvargas92495/app/components/Button";
import { ActionFunction, redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";
import deleteOnlineClient from "~/data/deleteOnlineClient.server";
import { v4} from "uuid";

const SingleConnectionPage = () => {
  return (
    <div className={"flex gap-4"}>
      <Form method={"delete"}>
        <Button>Delete</Button>
      </Form>
    </div>
  );
};

export const action: ActionFunction = (args) => {
  // return remixAdminAction(args, {
  //   DELETE: ({ params }) =>
     return deleteOnlineClient({
        id: args.params["id"] || "",
        requestId: args.context?.lambdaContext?.awsRequestId || v4(),
      }).then(() => redirect("/admin/connections"))//,
  // });
};

export default SingleConnectionPage;
