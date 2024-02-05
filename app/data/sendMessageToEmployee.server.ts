import { User } from "@clerk/clerk-sdk-node";
import getMysql from "./mysql.server";
import { VellumClient } from "vellum-ai";
import { WorkflowRequestInputRequest, ChatMessageRequest } from "vellum-ai/api";

const vellum = new VellumClient({
  apiKey: process.env.VELLUM_API_KEY ?? "",
});

const sendMessageToEmployee = async ({
  requestId,
  message,
  user,
}: {
  requestId: string;
  message: string;
  user: Pick<User, "firstName" | "lastName">;
}) => {
  await getMysql(requestId);
  const chatHistory: ChatMessageRequest[] = [
    {
      role: "USER",
      text: message,
    },
  ];
  const inputs: WorkflowRequestInputRequest[] = [
    {
      type: "CHAT_HISTORY",
      name: "$chat_history",
      value: chatHistory,
    },
    {
      type: "STRING",
      name: "user",
      value: `${user.firstName} ${user.lastName}`,
    },
  ];
  const response = await vellum.executeWorkflow({
    workflowDeploymentName: "chief-of-staff",
    inputs,
  });
  if (response.data.state === "FULFILLED") {
    const employeeOutput = response.data.outputs.find(
      (o) => o.name === "employee"
    );
    const resultsOutput = response.data.outputs.find(
      (o) => o.name === "results"
    );
    const plainOutput = response.data.outputs.find((o) => o.name === "plain");
    if (plainOutput) {
      return {
        response: plainOutput.value,
      };
    }
    const functionCall = JSON.parse(employeeOutput?.value as string);
    const functionName = functionCall.function_call.name;
    chatHistory.push(
      {
        role: "ASSISTANT",
        text: JSON.stringify({ function_call: functionCall }),
      },
      {
        role: "FUNCTION",
        text: JSON.stringify({
          name: functionName,
          content: (resultsOutput?.value as string) || "No results found",
        }),
      }
    );
    const secondResponse = await vellum.executeWorkflow({
      workflowDeploymentName: "chief-of-staff",
      inputs,
    });

    if (secondResponse.data.state === "FULFILLED") {
      return {
        response: secondResponse.data.outputs[0].value,
      };
    } else {
      return {
        response: `Failed to parse second message: ${secondResponse.data.error.message}`,
      };
    }
  } else {
    return {
      response: `Failed to parse message: ${response.data.error.message}`,
    };
  }
};

export default sendMessageToEmployee;
