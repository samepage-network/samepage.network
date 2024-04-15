import fs from "fs";
import path from "path";
import cp from "child_process";
import { VellumClient } from "vellum-ai";
import { z } from "zod";
import parseZodError from "package/utils/parseZodError";

const zInput = z.object({
  parameters: z.record(z.string()),
  commands: z
    .object({
      exec: z.string(),
      result: z.string(),
    })
    .array(),
});

const zOutput = z.object({
  next: z.record(z.string()),
  commands: z.string().array(),
});

const run = async () => {
  const vellum = new VellumClient({
    apiKey: process.env.VELLUM_API_KEY!,
  });
  const root = process.cwd();
  const workspaceRoot = path.join(root, "workspace");
  const nextInputLog = path.join(workspaceRoot, "next-inputs.json");
  const killSwitch = path.join(workspaceRoot, "kill.log");
  fs.writeFileSync(
    nextInputLog,
    JSON.stringify({ parameters: [], commands: [] })
  );
  const checkLoop = () => {
    const killLoop = fs.existsSync(killSwitch);
    if (killLoop) {
      console.log("Kill switch found. Exiting...");
      return false;
    }
    console.log(new Date().toISOString(), "Starting a new agent loop...");
    return true;
  };

  while (checkLoop()) {
    const input = zInput.parse(
      JSON.parse(fs.readFileSync(nextInputLog).toString())
    );
    const response = await vellum.executeWorkflow({
      workflowDeploymentName: process.env.VELLUM_WORKFLOW_DEPLOYMENT_NAME,
      releaseTag: "production",
      inputs: [
        { name: "input", type: "JSON", value: input },
        { name: "cwd", type: "STRING", value: process.cwd() },
      ],
    });

    if (response.data.state === "REJECTED") {
      console.error("Agent loop failed:", response.data.error.message);
      continue;
    }

    const { outputs } = response.data;
    const [output] = outputs;
    if (!output) {
      console.error("Agent loop failed: No outputs returned.");
      continue;
    }

    if (output.type !== "JSON") {
      console.error("Agent loop failed: Unexpected output type", output.type);
      continue;
    }

    const outputValue = zOutput.safeParse(output.value);
    if (!outputValue.success) {
      console.error("Agent loop failed:", parseZodError(outputValue.error));
      continue;
    }

    const { commands, next } = outputValue.data;
    const nextInput: z.infer<typeof zInput> = {
      parameters: next,
      commands: [],
    };
    for (const exec in commands) {
      const result = cp.execSync(exec);
      nextInput.commands.push({
        exec,
        result: result.toString(),
      });
    }
    fs.writeFileSync(nextInputLog, JSON.stringify(nextInput));

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

run();
