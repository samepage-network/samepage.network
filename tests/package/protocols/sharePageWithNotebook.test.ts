import { test, expect } from "@playwright/test";
import { receiveChunkedMessage } from "../../../package/internal/setupMessageHandlers";
import { InitialSchema, LatestSchema } from "../../../package/internal/types";
import sharePageWithNotebook from "../../../package/protocols/sharePageWithNotebook";
import { v4 } from "uuid";
import wrapSchema from "../../../package/utils/wrapSchema";
import Automerge from "automerge";
import binaryToBase64 from "../../../package/internal/binaryToBase64";
import { Response } from "@remix-run/node";
import { onAppEvent } from "../../../package/internal/registerAppEventListener";
import dispatchAppEvent from "../../../package/internal/dispatchAppEvent";
import getRandomNotebookPageId from "../../utils/getRandomNotebookPageId";
import { set } from "../../../package/utils/localAutomergeDb";
import mockSchema from "../../utils/mockSchema";

test.beforeAll(() => {
  global.fetch = (_, options) => {
    const body = JSON.parse((options?.body as string) || "{}");
    if (body.method === "list-shared-pages") {
      return Promise.resolve(
        new Response(JSON.stringify({ notebookPageIds: [] }), { status: 200 })
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
  };
});

const sharePageUpdate = (notebookPageId: string, changes: string[]) =>
  receiveChunkedMessage(
    JSON.stringify({
      message: JSON.stringify({
        operation: "SHARE_PAGE_UPDATE",
        changes,
        notebookPageId,
      }),
      uuid: v4(),
      chunk: 0,
      total: 1,
    })
  );

// - apply 1
// - apply 2
// - save 1 => error bc 1 is now outdated.
test("Handle receiving multiple changes before saving", async () => {
  const notebookPageId = await getRandomNotebookPageId();
  const state: InitialSchema = { content: "Hello, world", annotations: [] };
  const doc = Automerge.from(wrapSchema(state));
  set(notebookPageId, doc);
  const applyResolves: (() => void)[] = [];
  const { unload } = sharePageWithNotebook({
    encodeState: async () => ({ $body: state }),
    decodeState: (_, _s) => {
      const s = _s.$body;
      state.content = s.content;
      state.annotations = s.annotations;
      return new Promise<void>((resolve) => {
        applyResolves.push(() => {
          resolve();
        });
      });
    },
  });
  dispatchAppEvent({ type: "connection", status: "CONNECTED" });

  const otherNotebookState = Automerge.load<LatestSchema>(Automerge.save(doc));
  const otherNotebookState2 = Automerge.change(
    otherNotebookState,
    "v2",
    (doc) => {
      doc.content.insertAt?.(12, ..." again");
    }
  );
  const changes1 = Automerge.getChanges(
    otherNotebookState,
    otherNotebookState2
  ).map(binaryToBase64);
  sharePageUpdate(notebookPageId, changes1);

  const otherNotebookState3 = Automerge.change(
    otherNotebookState2,
    "v2",
    (doc) => {
      doc.content.insertAt?.(18, ..." and again");
    }
  );
  const changes2 = Automerge.getChanges(
    otherNotebookState2,
    otherNotebookState3
  ).map(binaryToBase64);
  sharePageUpdate(notebookPageId, changes2);

  const logs: string[] = [];
  const offAppEvent = onAppEvent("log", (e) => {
    if (e.intent === "debug" || e.intent === "success") {
      logs.push(e.content);
    } else if (e.intent === "error" || e.intent === "warning") {
      throw new Error(e.content);
    }
  });

  await expect.poll(() => applyResolves).toHaveLength(2);
  applyResolves.splice(0, 1)[0]();
  await expect.poll(() => logs.shift()).toEqual(`Applied update`);
  applyResolves.splice(0, 1)[0]();
  await expect.poll(() => logs.shift()).toEqual(`Applied update`);

  expect(state).toEqual({
    content: "Hello, world again and again",
    annotations: [],
  });

  offAppEvent();
  unload();
});

test("Should not apply state for updates that aren't shared", async () => {
  const notebookPageId = await getRandomNotebookPageId();
  const state: Record<string, InitialSchema> = {
    [notebookPageId]: { content: "Hello, world", annotations: [] },
  };
  const doc = Automerge.from(wrapSchema(state[notebookPageId]));
  set(notebookPageId, doc);
  const { unload } = sharePageWithNotebook({
    encodeState: async (id) => ({ $body: state[id] }),
    decodeState: async (id, _s) => {
      const s = _s.$body;
      state[id].content = s.content;
      state[id].annotations = s.annotations;
    },
  });
  dispatchAppEvent({ type: "connection", status: "CONNECTED" });

  const randomOtherState = mockSchema("Ignore me");
  const randomOtherState2 = Automerge.change(randomOtherState, "v2", (doc) => {
    doc.content.insertAt?.(9, ..." again");
  });
  const changes = Automerge.getChanges(randomOtherState, randomOtherState2).map(
    binaryToBase64
  );
  sharePageUpdate(await getRandomNotebookPageId(), changes);

  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(state).toEqual({
    [notebookPageId]: { content: "Hello, world", annotations: [] },
  });

  unload();
});
