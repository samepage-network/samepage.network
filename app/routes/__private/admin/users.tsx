import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Outlet, Form, useActionData } from "@remix-run/react";
import Table from "~/components/Table";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import listUsers from "~/data/listUsers.server";
import TextInput from "package/components/TextInput";
import Button from "package/components/Button";
import remixAdminAction from "~/data/remixAdminAction.server";
import getMysql from "~/data/mysql.server";
import { notebooks, tokens, tokenNotebookLinks } from "data/schema";
import { sql } from "drizzle-orm/sql";
import { eq } from "drizzle-orm/expressions";
import deleteUser from "~/data/deleteUser.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const UsersPage = () => {
  const actionData = useActionData();
  return (
    <div className={"flex gap-8 items-start"}>
      <div className="max-w-3xl w-full">
        <Form method="get" className="flex items-center max-w-lg gap-8">
          <TextInput
            label={"Search"}
            name={"search"}
            placeholder={"Search by email"}
            className={"flex-grow"}
          />
          <Button>Search</Button>
        </Form>
        <Table onRowClick={"id"} />
        <Form method={"delete"} className={"mt-16"}>
          <h3 className="font-bold text-xl mb-4">Clear Test Users</h3>
          <Button intent="danger">Delete</Button>
          {actionData?.success && (
            <>
              <div>
                <b>Total Users:</b> {actionData.total}
              </div>
              <div>
                <b>Test Users Deleted:</b> {actionData.testUsers}
              </div>
            </>
          )}
        </Form>
      </div>
      <div className={"flex-grow-1 overflow-auto"}>
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ searchParams }) => listUsers(searchParams));
};

export const action: ActionFunction = (args) => {
  return remixAdminAction(args, {
    DELETE: async ({ context: { requestId } }) => {
      const users = await listUsers({ index: "1", size: "500" });
      const cxn = await getMysql(requestId);
      const userData = await Promise.all(
        users.data.map((user) =>
          cxn
            .select({ total: sql`COUNT(${notebooks.uuid})` })
            .from(notebooks)
            .innerJoin(
              tokenNotebookLinks,
              eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
            )
            .innerJoin(tokens, eq(tokens.uuid, tokenNotebookLinks.tokenUuid))
            .where(eq(tokens.userId, user.id))
            .then(([{ total }]) => ({ total, user }))
        )
      );
      const testUsers = userData.filter(
        (ud) =>
          ud.total === 0 &&
          !!ud.user.email &&
          /[a-f0-9]{8}@samepage\.network/.test(ud.user.email)
      );
      await testUsers.reduce(
        (p, c) =>
          p.then(async () => {
            await deleteUser({ id: c.user.id, requestId: cxn });
          }),
        Promise.resolve()
      );
      await cxn.end();
      return {
        success: true,
        total: userData.length,
        testUsers: testUsers.length,
      };
    },
  });
};

export const handle = {
  Title: "Users",
};

export default UsersPage;
