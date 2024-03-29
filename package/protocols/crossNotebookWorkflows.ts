import {
  CommandHandler,
  CommandLibrary,
  DecodeState,
  EncodeState,
  referenceAnnotation,
  SamePageSchema,
  WorkflowContext,
  zSamePageSchema,
} from "../internal/types";
import { z } from "zod";
import { app, getSetting } from "../internal/registry";
import apiClient from "../internal/apiClient";
import { NULL_TOKEN } from "../utils/atJsonParser";

type ReferenceAnnotation = z.infer<typeof referenceAnnotation>;

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
  appCommands = {},
}: {
  decodeState: DecodeState;
  encodeState: EncodeState;
  appCommands?: CommandLibrary;
}) => {
  const triggerWorkflow = async ({
    source,
    target,
  }: {
    source: string;
    target: string;
  }) => {
    const notebookUuid = getSetting("uuid");
    const state = await encodeState(source);
    const context: WorkflowContext = { variables: {}, target };
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
          ...$args
        } = command;
        const text = $command.content.trim();
        const commandContext = $context.content.trim();
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
