import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { padawanMissions } from "data/schema";
import { eq } from "drizzle-orm/mysql-core/expressions";
import Button from "package/components/Button";
import getMysql from "~/data/mysql.server";
import remixAdminAction from "~/data/remixAdminAction.server";
import remixAdminLoader from "~/data/remixAdminLoader.server";

export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const PadawanMissionPage = () => {
  const {
    mission: { label },
  } = useLoaderData<{ mission: { label: string } }>();
  return (
    <div>
      <h1 className="my-4 text-3xl">{label}</h1>
      <Form method={"delete"}>
        <Button>Delete</Button>
      </Form>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, async ({ context: { requestId }, params }) => {
    const cxn = await getMysql(requestId);
    const [mission] = await cxn
      .select()
      .from(padawanMissions)
      .where(eq(padawanMissions.uuid, params.uuid || ""));
    await cxn.end();
    return {
      mission,
    };
  });
};

export const action: ActionFunction = async (args) => {
  return remixAdminAction(args, {
    DELETE: async ({ context: { requestId }, params }) => {
      const cxn = await getMysql(requestId);
      await cxn
        .delete(padawanMissions)
        .where(eq(padawanMissions.uuid, params.uuid || ""));
      await cxn.end();
      return redirect(`/admin/padawan`);
    },
  });
};

export default PadawanMissionPage;
