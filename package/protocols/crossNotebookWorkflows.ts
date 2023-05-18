import {
  DecodeState,
  EncodeState,
  referenceAnnotation,
  SamePageSchema,
  SamePageState,
  zSamePageSchema,
  zWorkflowContext,
} from "../internal/types";
import { z } from "zod";
import { app, getSetting } from "../internal/registry";
import apiClient from "../internal/apiClient";
import { NULL_TOKEN } from "../utils/atJsonParser";

type ReferenceAnnotation = z.infer<typeof referenceAnnotation>;

type WorkflowContext = z.infer<typeof zWorkflowContext>;

type WorkflowParameters = {
  state: SamePageState;
  context: WorkflowContext;
};

type CommandHandler = (
  args: Record<string, string>,
  context: WorkflowContext
) => SamePageSchema | Promise<SamePageSchema>;

type CommandLibrary = Record<
  string,
  { handler: CommandHandler; help?: string }
>;

const samePageCommands: CommandLibrary = {
  GET: {
    handler: async ({ key }, { variables }) => {
      const value = variables[key];
      if (typeof value === "undefined" || value === null)
        return { content: "", annotations: [] };
      return {
        content: value.toString(),
        annotations: [],
      };
    },
  },
  SET: {
    handler: async ({ key, value }, { variables }) => {
      variables[key] = value;
      return {
        content: "",
        annotations: [],
      };
    },
  },
};

const EMPTY_SCHEMA = { content: "", annotations: [] };

const setupCrossNotebookWorkflows = ({
  decodeState,
  encodeState,
}: {
  decodeState: DecodeState;
  encodeState: EncodeState;
}) => {
  const appCommands: CommandLibrary = {};
  const triggerWorkflow = async ({ state, context }: WorkflowParameters) => {
    const notebookUuid = getSetting("uuid");
    const output = await state.$body.annotations
      .filter(
        (a): a is ReferenceAnnotation =>
          a.type === "reference" &&
          state.$body.content.slice(a.start, a.end) === NULL_TOKEN
      )
      .map((a) => async (prev: SamePageSchema) => {
        if (context.exitWorkflow) return EMPTY_SCHEMA;
        // TODO - Cross notebook referenced commands!! We may never want to support this
        if (a.attributes.notebookUuid !== notebookUuid) return EMPTY_SCHEMA;
        const command = await encodeState(a.attributes.notebookPageId);
        if (!("$command" in command)) return EMPTY_SCHEMA;
        const {
          $command,
          $context = { content: "samepage", annotations: [] },
          // $returns = { content: "text", annotations: [] },
          ...$args
        } = command;
        const text = $command.content.trim();
        const commandContext = $context.content.trim();
        // const returns = atJsonToRoam($returns);
        const args = Object.fromEntries(
          Object.entries($args).map(([k, v]) => [k, v.content.trim()])
        );
        const value =
          commandContext === "samepage"
            ? !samePageCommands[text]
              ? EMPTY_SCHEMA
              : await samePageCommands[text].handler(args, context)
            : commandContext === app
            ? !appCommands[text]
              ? EMPTY_SCHEMA
              : await appCommands[text].handler(args, context)
            : await apiClient({
                method: "call-workflow-command",
                text,
                commandContext,
                args,
                workflowContext: context,
              })
                .then((r) => zSamePageSchema.parseAsync(r.response))
                .catch((e) => ({
                  content: `Failed to run ${text} from ${commandContext}: ${e.message}`,
                  annotations: [],
                }));
        const offset = value.content.length - 1;
        return {
          content: `${prev.content.slice(0, a.start)}${
            value.content
          }${prev.content.slice(a.end)}`,
          annotations: prev.annotations
            .filter((pa) => pa !== a)
            .map((pa) => {
              if (pa.start > a.start) {
                pa.start += offset;
              }
              if (pa.end > a.start) {
                pa.end += offset;
              }
              return pa;
            }),
        };
      })
      .reduce((prev, curr) => prev.then(curr), Promise.resolve(state.$body));
    await decodeState(context.target, { $body: output });
  };
  return {
    unload: () => {},
    registerWorkflowCommand: ({
      text,
      handler,
      help,
    }: {
      text: string;
      handler: CommandHandler;
      help?: string;
    }) => {
      appCommands[text] = { handler, help };
      return () => delete appCommands[text];
    },
    triggerWorkflow,
  };
};

export default setupCrossNotebookWorkflows;
