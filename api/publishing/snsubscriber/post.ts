import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import invokeAsync from "~/data/invokeAsync.server";
import { z } from "zod";
import { UnauthorizedError } from "~/data/errors.server";

const bodySchema = z.object({ event: z.record(z.unknown()) });

const logic = async ({
  authorization,
  event,
}: BackendRequest<typeof bodySchema>) => {
  if (authorization !== process.env.SAMEPAGE_DEVELOPER_TOKEN) {
    throw new UnauthorizedError("Invalid token.");
  }

  await invokeAsync({
    path: "snsubscriber",
    data: event,
  });
  return { success: true };
};

export default createAPIGatewayProxyHandler(logic);
