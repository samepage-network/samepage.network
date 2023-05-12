import { padawanMissionSteps, padawanMissions } from "data/schema";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import { z } from "zod";
import getMysql from "~/data/mysql.server";
import crypto from "crypto";
import uploadFile from "~/data/uploadFile.server";

const bodySchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("CREATE"),
    missionUuid: z.string(),
    label: z.string(),
  }),
  z.object({
    method: z.literal("ADD_STEP"),
    missionUuid: z.string(),
    step: z.object({
      thought: z.string(),
      action: z.string(),
      actionInput: z.string(),
      observation: z.string(),
    }),
  }),
]);

const logic = async (args: BackendRequest<typeof bodySchema>) => {
  const cxn = await getMysql(args.requestId);
  const { method } = args;
  if (method === "CREATE") {
    const { missionUuid, label } = args;
    await cxn.insert(padawanMissions).values({
      uuid: missionUuid,
      label,
      startDate: new Date(),
    });
  } else if (method === "ADD_STEP") {
    const { missionUuid, step } = args;
    const hash = crypto
      .createHash("sha256")
      .update(step.thought)
      .update(step.action)
      .update(step.actionInput)
      .update(step.observation)
      .digest("hex");
    await uploadFile({
      Key: `data/padawan/steps/${hash}.json`,
      Body: JSON.stringify(step),
    });
    await cxn.insert(padawanMissionSteps).values({
      uuid: missionUuid,
      missionUuid,
      stepHash: hash,
      executionDate: new Date(),
    });
  }
  await cxn.end();
  return { success: true };
};

export default createAPIGatewayProxyHandler({ logic, bodySchema });
