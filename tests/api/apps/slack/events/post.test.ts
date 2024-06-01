import { v4 } from "uuid";
import handler from "../../../../../api/apps/slack/events/post";
import { createMockLambdaStep, setupFetchMock } from "../../../fixtures";
import { test, expect } from "@playwright/test";
import randomString from "../../../../../app/data/randomString.server";

const mockLambda = createMockLambdaStep<Record<string, unknown>>({
  path: "apps/slack/events",
  getStep: () => `apps/slack/events`,
  handler,
});

test.beforeAll(() => {
  setupFetchMock();
});

test("Happy path for webhook endpoint", async () => {
  const team = `T${await randomString({
    length: 6,
    encoding: "base64",
  })}`;
  const user = `U${await randomString({
    length: 6,
    encoding: "base64",
  })}`;
  const mockWebhookEvent = {
    requestId: v4(),
    token: await randomString({
      length: 12,
      encoding: "base64",
    }),
    team_id: team,
    api_app_id: `A${await randomString({
      length: 6,
      encoding: "base64",
    })}`,
    event: {
      user,
      type: "app_mention",
      ts: "1715607579.880479",
      client_msg_id: v4(),
      text: "Does this work?",
      team,
      blocks: [[{}]],
      channel: `C${await randomString({
        length: 6,
        encoding: "base64",
      })}`,
      event_ts: "1715607579.880479",
    },
    type: "event_callback",
    event_id: `Ev${await randomString({
      length: 6,
      encoding: "base64",
    })}`,
    event_time: 1715607579,
    authorizations: [
      {
        enterprise_id: null,
        team_id: team,
        user_id: user,
        is_bot: true,
        is_enterprise_install: false,
      },
    ],
    is_ext_shared_channel: false,
    event_context: await randomString({
      length: 24,
      encoding: "base64",
    }),
  };

  const response = await mockLambda({
    ...mockWebhookEvent,
    Body: "What are my todos for today?",
  });

  expect(typeof response.uuid).toBe("string");
});
