import { ActionFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData, useSubmit } from "@remix-run/react";
import {
  padawanMissionSteps,
  padawanMissions,
  padawanMissionEvents,
} from "data/schema";
import { eq, desc } from "drizzle-orm/mysql-core/expressions";
import Button from "package/components/Button";
import { downloadFileContent } from "~/data/downloadFile.server";
import getMysql from "~/data/mysql.server";
import remixAdminAction from "~/data/remixAdminAction.server";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import { z } from "zod";
import React, { useEffect, useMemo } from "react";
import { v4 } from "uuid";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const stepSchema = z.object({
  thought: z.string(),
  action: z.string(),
  actionInput: z.string(),
  generation: z.string(),
  observation: z.string(),
  uuid: z.string(),
  date: z.number(),
});

const PadawanMissionStep = (
  step: z.infer<typeof stepSchema> & { index: number }
) => {
  const [showGeneration, setShowGeneration] = React.useState(false);
  return (
    <div className="border rounded-2xl shadow-lg bg-slate-100 p-4">
      <h1 className="font-semibold text-lg mb-4">Step {step.index + 1}</h1>
      <p className="text-sm mb-2">{step.thought}</p>
      <p className="mb-2">
        <span className="font-bold text-blue-950">{step.action}:</span>{" "}
        <code>{step.actionInput}</code>
      </p>
      <p className="text-sm mb-2">
        <>Executed on {new Date(step.date).toLocaleString()}. Observation:</>
      </p>
      <p className="text-sm mb-2">{step.observation}</p>
      {showGeneration ? (
        <pre className="mt-4 rounded-2xl border shadow-lg bg-slate-300 relative p-4">
          <span
            className="absolute right-4 top-4 h-8 w-8 bg-red-500 cursor-pointer rounded-full flex items-center justify-center text-white"
            onClick={() => setShowGeneration(false)}
          >
            x
          </span>
          <code>{step.generation}</code>
        </pre>
      ) : (
        <span
          className="underline cursor-pointer text-sm"
          onClick={() => setShowGeneration(true)}
        >
          More info
        </span>
      )}
    </div>
  );
};

const PadawanMissionPage = () => {
  const {
    events,
    mission: { label },
    steps,
  } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const status = useMemo(() => events[0]?.status || "RUNNING", [events]);
  useEffect(() => {
    // TODO - replace with a websocket
    if (status !== "FINISHED") {
      const interval = setInterval(() => {
        submit({}, { method: "GET" });
      }, 1000 * 30);
      return () => {
        clearInterval(interval);
      };
    }
    return () => {};
  }, [status, submit]);
  return (
    <div className="flex flex-col gap-4 h-full">
      <h1 className="my-4 text-3xl">
        {label} [{status}]
      </h1>
      <div className="flex-grow flex flex-col gap-2">
        {steps.map((step, index) => (
          <PadawanMissionStep {...step} key={step.uuid} index={index} />
        ))}
      </div>
      <div className="flex items-center gap-4">
        <Form method={"post"}>
          <Button name={"status"} value={"interupted"}>
            Stop
          </Button>
        </Form>
        <Form method={"delete"}>
          <Button intent={"danger"}>Delete</Button>
        </Form>
      </div>
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
    const events = await cxn
      .select({
        status: padawanMissionEvents.status,
        date: padawanMissionEvents.createdDate,
      })
      .from(padawanMissionEvents)
      .where(eq(padawanMissionEvents.missionUuid, missionUuid))
      .orderBy(desc(padawanMissionEvents.createdDate));
    const stepRecords = await cxn
      .select({
        uuid: padawanMissionSteps.uuid,
        hash: padawanMissionSteps.stepHash,
        date: padawanMissionSteps.executionDate,
      })
      .from(padawanMissionSteps)
      .where(eq(padawanMissionSteps.missionUuid, missionUuid))
      .orderBy(padawanMissionSteps.executionDate);
    const steps = await Promise.all(
      stepRecords.map(async ({ hash, uuid, date }) =>
        Promise.all([
          downloadFileContent({ Key: `data/padawan/steps/${hash}.json` }),
          downloadFileContent({
            Key: `data/padawan/observations/${hash}.json`,
          }),
        ])
          .then(([action, observation]) => ({
            ...JSON.parse(action),
            ...(observation
              ? JSON.parse(observation)
              : { observation: "Action failed" }),
            uuid,
            date: date.valueOf(),
          }))
          .then(stepSchema.parse)
          .catch((error) => {
            console.error(hash, "failed to download");
            return Promise.reject(error);
          })
      )
    );

    await cxn.end();
    return {
      mission,
      steps,
      events,
    };
  });
};

export const action: ActionFunction = async (args) => {
  return remixAdminAction(args, {
    DELETE: async ({ context: { requestId }, params }) => {
      const cxn = await getMysql(requestId);
      const missionUuid = params.uuid || "";
      await cxn
        .delete(padawanMissionSteps)
        .where(eq(padawanMissionSteps.missionUuid, missionUuid));
      await cxn
        .delete(padawanMissions)
        .where(eq(padawanMissions.uuid, missionUuid));
      await cxn.end();
      return redirect(`/admin/padawan`);
    },
    POST: async ({ context: { requestId }, data, params }) => {
      console.log(data);
      const missionUuid = params.uuid || "";
      const cxn = await getMysql(requestId);
      await cxn.insert(padawanMissionEvents).values({
        status: "STOP",
        uuid: v4(),
        missionUuid,
        createdDate: new Date(),
      });
      await cxn.end();
      return { success: true };
    },
  });
};

export default PadawanMissionPage;
