import React from "react";
import { Form, LoaderFunctionArgs, useLoaderData } from "react-router-dom";
import Button from "./Button";
import TextInput from "./TextInput";
import BaseInput from "./BaseInput";
import authenticateRequest from "../internal/authenticateRequest";
import { AuthenticateNotebook } from "../internal/types";

const HomeDashboardTab = ({
  onLogOut,
  url,
}: {
  onLogOut: () => void;
  url: string;
}): React.ReactElement => {
  const data = useLoaderData() as Awaited<
    ReturnType<ReturnType<typeof makeLoader>>
  >;
  return (
    <div>
      <h1 className="font-bold mb-4 text-xl">SamePage Widget</h1>
      <div className="mb-2">
        This widget helps you manage all your SamePage related resources!
      </div>
      {!data.auth ? (
        <Form method={"post"}>
          <div className="mb-2">
            Log into your SamePage account to get started.
          </div>
          <TextInput
            name={"email"}
            label={"Email"}
            placeholder="support@samepage.network"
          />
          <BaseInput
            type={"password"}
            name={"password"}
            label={"Password"}
            placeholder="****************"
          />
          <input type="hidden" name="origin" value={url} />
          <Button>Log In</Button>
        </Form>
      ) : (
        <div>
          <div className="mb-2">
            Successfully logged in! Click on one of the resources on the left to
            get started.
          </div>
          <Button type={"button"} onClick={onLogOut}>
            Log Out
          </Button>
        </div>
      )}
    </div>
  );
};

export const makeLoader =
  ({ authenticateNotebook }: { authenticateNotebook: AuthenticateNotebook }) =>
  async (args: LoaderFunctionArgs) => {
    const result = await authenticateRequest({ args, authenticateNotebook });
    if (!result.auth) {
      return {
        auth: false as const,
      };
    }
    return {
      auth: true as const,
      app: result.app,
      workspace: result.workspace,
    };
  };

export default HomeDashboardTab;
