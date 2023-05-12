import { ActionFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { padawanMissionSteps, padawanMissions } from "data/schema";
import { eq } from "drizzle-orm/mysql-core/expressions";
import Button from "package/components/Button";
import { downloadFileContent } from "~/data/downloadFile.server";
import getMysql from "~/data/mysql.server";
import remixAdminAction from "~/data/remixAdminAction.server";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import { z } from "zod";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const stepSchema = z.object({
  thought: z.string(),
  action: z.string(),
  actionInput: z.string(),
  observation: z.string(),
});

const PadawanMissionPage = () => {
  const {
    mission: { label },
    steps,
  } = useLoaderData<typeof loader>();
  return (
    <div className="flex flex-col gap-4 h-full">
      <h1 className="my-4 text-3xl">{label}</h1>
      <div className="flex-grow">
        {steps.map((step) => (
          <div>
            <h1>{step.thought}</h1>
            <p>
              {step.action}: <code>{step.actionInput}</code>
            </p>
            <p>{step.observation}</p>
          </div>
        ))}
      </div>
      <Form method={"delete"}>
        <Button>Delete</Button>
      </Form>
    </div>
  );
};

export const loader = (args: LoaderArgs) => {
  return remixAdminLoader(args, async ({ context: { requestId }, params }) => {
    const cxn = await getMysql(requestId);
    const missionUuid = params.uuid || "";
    const [mission] = await cxn
      .select({
        label: padawanMissions.label,
      })
      .from(padawanMissions)
      .where(eq(padawanMissions.uuid, missionUuid));
    const stepRecords = await cxn
      .select({
        uuid: padawanMissionSteps.uuid,
        hash: padawanMissionSteps.stepHash,
      })
      .from(padawanMissionSteps)
      .where(eq(padawanMissionSteps.missionUuid, missionUuid));
    const steps = await Promise.all(
      stepRecords.map(async ({ hash }) =>
        downloadFileContent({ Key: `data/padawan/steps/${hash}.json` })
          .then(JSON.parse)
          .then(stepSchema.parse)
      )
    );

    await cxn.end();
    return {
      mission,
      steps,
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
