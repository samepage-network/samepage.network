import createAPIGatewayProxyHandler from "~/data/createAPIGatewayProxyHandler.server";
import { Lambda } from "@aws-sdk/client-lambda";

const lambda = new Lambda({});

/** Creates a card with two widgets. */
const logic = async () => {
  const invokeLambda = await lambda.invoke({
    FunctionName: "samepage-network_monday_post",
    Payload: Buffer.from(JSON.stringify({})),
  });
  const cards = invokeLambda.Payload
    ? (JSON.parse(Buffer.from(invokeLambda.Payload).toString("utf-8")) as {
        id: string;
        name: string;
      }[][])
    : [];
  const navigations = cards.map((card, index) => ({
    pushCard: {
      header: {
        title: `Board ${index + 1}`,
      },
      sections: card.map((item) => ({
        textParagraph: {
          text: `Item: ${item.name} (${item.id})`,
        },
      })),
    },
  }));
  return {
    action: {
      navigations,
    },
  };
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/^https:\/\/([\w]+\.)?google\.com/],
});
