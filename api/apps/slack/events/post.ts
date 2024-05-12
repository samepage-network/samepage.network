import createAPIGatewayHandler from "samepage/backend/createAPIGatewayProxyHandler";
import { z } from "zod";

const zArgs = z.discriminatedUnion("type", [
  z.object({
    challenge: z.string(),
    type: z.literal("url_verification"),
    token: z.string(),
  }),
]);

const logic = async (evt: unknown) => {
  const event = zArgs.parse(evt);
  switch (event.type) {
    case "url_verification": {
      const { challenge } = event;
      return {
        challenge,
      };
    }
    default: {
      throw new Error(`Unexpected event type: ${event.type}`);
    }
  }
};

export default createAPIGatewayHandler(logic);
