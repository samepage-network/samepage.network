import getMysql from "./mysql.server";
import { VellumClient } from "vellum-ai";

const vellum = new VellumClient({
  apiKey: process.env.VELLUM_API_KEY ?? "",
});

const sendMessageToAssistant = async ({
  requestId,
  message,
}: {
  requestId: string;
  message: string;
}) => {
  await getMysql(requestId);
  const result = await vellum.executePrompt({
    promptDeploymentName: "master-assistant",
    inputs: [
      {
        type: "CHAT_HISTORY",
        name: "$chat_history",
        value: [
          {
            role: "USER",
            text: message,
          },
        ],
      },
    ],
  });
  if (result.state === "FULFILLED")
    return {
      response: result.outputs[0].value,
    };
  else
    return {
      response: `Failed to parse message: ${result.error.message}`,
    };
};

export default sendMessageToAssistant;
