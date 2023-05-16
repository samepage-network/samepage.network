import type { Handler } from "aws-lambda";
import {
  OnboardNotebookResponse,
  zOnboardNotebookPayload,
} from "package/backend/types";
import getMysql from "~/data/mysql.server";
import onboardNotebook from "~/data/onboardNotebook.server";

export const handler: Handler<unknown, OnboardNotebookResponse> = async (
  event,
  context
) => {
  const parsedEvent = zOnboardNotebookPayload.parse(event);
  const requestId = context.awsRequestId;
  const cxn = await getMysql(requestId);
  const response = await onboardNotebook({
    requestId,
    ...parsedEvent,
  });
  await cxn.end();
  return response;
};
