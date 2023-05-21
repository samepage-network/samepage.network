import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Form, Outlet } from "@remix-run/react";
import { padawanMissions } from "data/schema";
import Button from "package/components/Button";
import TextInput from "package/components/TextInput";
import { apiPost } from "package/internal/apiClient";
import { v4 } from "uuid";
import NumberInput from "~/components/NumberInput";
import Table from "~/components/Table";
import getMysql from "~/data/mysql.server";
import remixAdminAction from "~/data/remixAdminAction.server";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import { z } from "zod";
import { desc } from "drizzle-orm/mysql-core/expressions";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const PadawanAdminPage = () => {
  return (
    <div className="flex gap-12">
      <div className="flex flex-col gap-8 max-w-3xl w-full flex-shrink-0">
        <Form method="post">
          <TextInput
            label={"Owner"}
            name={"owner"}
            defaultValue={"dvargas92495"}
          />
          <TextInput
            label={"Repository"}
            name={"repo"}
            defaultValue={"roamjs-smartblocks"}
          />
          <NumberInput
            label={"Issue Number"}
            name={"issue"}
            defaultValue={63}
          />
          <TextInput
            label={"Label"}
            name={"label"}
            defaultValue={`Padawan Mission ${v4().slice(0, 8)}`}
          />
          <Button>Assign</Button>
        </Form>
        <h2 className="text-xl">Past Missions</h2>
        <Table onRowClick={"uuid"} />
      </div>
      <div className="flex-grow overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, async ({ context: { requestId } }) => {
    const cxn = await getMysql(requestId);
    const missions = await cxn
      .select()
      .from(padawanMissions)
      .orderBy(desc(padawanMissions.startDate));
    await cxn.end();
    return {
      columns: [
        {
          Header: "Label",
          accessor: "label",
        },
        {
          Header: "Start Date",
          accessor: "startDate",
        },
      ],
      data: missions,
      count: missions.length,
    };
  });
};

const zData = z.object({
  owner: z.tuple([z.string()]).transform((v) => v[0]),
  repo: z.tuple([z.string()]).transform((v) => v[0]),
  label: z.tuple([z.string()]).transform((v) => v[0]),
  issue: z.tuple([z.string()]).transform((v) => Number(v[0])),
});

export const action: ActionFunction = async (args) => {
  return remixAdminAction(args, {
    POST: async ({ context: { requestId }, data }) => {
      const { owner, repo, issue, label } = zData.parse(data);
      const missionUuid = v4();
      const cxn = await getMysql(requestId);
      await cxn.insert(padawanMissions).values({
        uuid: missionUuid,
        label,
        startDate: new Date(),
      });
      await cxn.end();
      await apiPost<{ uuid: string }>({
        domain: "http://localhost:3001",
        path: `develop`,
        data: {
          owner,
          repo,
          issue,
          type: "User",
          missionUuid,
          webhookUrl: `${process.env.API_URL}/padawan`,
        },
      });
      return redirect(`/admin/padawan/${missionUuid}`);
    },
  });
};

export const handle = {
  Title: "Padawan",
};
export default PadawanAdminPage;
