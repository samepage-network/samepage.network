import React from "react";
import {
  ActionFunctionArgs,
  Form,
  Link,
  LoaderFunctionArgs,
  useLoaderData,
  redirect,
} from "react-router-dom";
import Button from "./Button";
import TextInput from "./TextInput";
import BaseInput from "./BaseInput";
import authenticateRequest from "../internal/authenticateRequest";
import {
  AuthenticateNotebook,
  AuthenticateUser,
  ListUserNotebooks,
} from "../internal/types";
import { BadRequestResponse, NotFoundResponse } from "../utils/responses";
import parseRequestContext from "../internal/parseRequestContext";

const base64 =
  typeof window !== "undefined"
    ? (s: string) => window.btoa(s)
    : (s: string) => Buffer.from(s).toString("base64");

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
    <div className="flex flex-col h-full">
      <h1 className="font-bold mb-4 text-xl">SamePage</h1>
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
        <div className="flex-grow flex flex-col items-start">
          <div className="mb-2 flex-grow">
            <p className="mb-2">
              Successfully logged into your notebook,{" "}
              <span className="font-semibold italic">
                <span className="text-lg">
                  {
                    data.notebooks.find(
                      (notebook) => notebook.uuid === data.notebookUuid
                    )?.appName
                  }
                </span>{" "}
                <span>
                  {
                    data.notebooks.find(
                      (notebook) => notebook.uuid === data.notebookUuid
                    )?.workspace
                  }
                </span>
              </span>
              ! Click on one of the resources on the left to get started. You
              can also switch to any of your other notebooks below:
            </p>
            <ul className="pl-8">
              {data.notebooks
                .filter((notebook) => notebook.uuid !== data.notebookUuid)
                .map((notebook) => (
                  <li key={notebook.uuid} className={"list-disc"}>
                    <Link
                      to={`?auth=${base64(`${notebook.uuid}:${data.token}`)}`}
                      className={"text-sky-500 underline hover:no-underline"}
                    >
                      <span className="text-lg font-semibold">
                        {notebook.appName}
                      </span>{" "}
                      <span>{notebook.workspace}</span>
                    </Link>
                  </li>
                ))}
            </ul>
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
  ({
    authenticateNotebook,
    listUserNotebooks,
  }: {
    authenticateNotebook: AuthenticateNotebook;
    listUserNotebooks: ListUserNotebooks;
  }) =>
  async (args: LoaderFunctionArgs) => {
    const result = await authenticateRequest({ args, authenticateNotebook });
    if (!result.auth) {
      return {
        auth: false as const,
      };
    }
    const { notebooks } = await listUserNotebooks({
      requestId: result.requestId,
      userId: result.userId,
      token: result.token,
    });
    return {
      auth: true as const,
      notebookUuid: result.notebookUuid,
      token: result.token,
      notebooks,
    };
  };

export const makeAction =
  ({ authenticateUser }: { authenticateUser: AuthenticateUser }) =>
  async (args: ActionFunctionArgs) => {
    if (args.request.method !== "POST")
      throw new NotFoundResponse(`Unsupported method ${args.request.method}`);
    const data = await args.request.formData();
    const email = data.get("email");
    const password = data.get("password");
    const origin = data.get("origin");
    if (typeof email !== "string" || !email) {
      throw new BadRequestResponse("Missing email");
    }
    if (typeof password !== "string" || !password) {
      throw new BadRequestResponse("Missing password");
    }
    if (typeof origin !== "string" || !origin) {
      throw new BadRequestResponse("Missing origin");
    }
    const { requestId } = parseRequestContext(args.context);
    const authenticatedUser = await authenticateUser({
      email,
      password,
      requestId,
      origin,
    });
    if (!("notebookUuid" in authenticatedUser)) {
      return redirect(
        `/embeds?user_auth=${Buffer.from(
          `${authenticatedUser.userId}:${authenticatedUser.token}`
        ).toString("base64")}`
      );
    }
    return redirect(
      `/embeds?auth=${Buffer.from(
        `${authenticatedUser.notebookUuid}:${authenticatedUser.token}`
      ).toString("base64")}`
    );
  };

export default HomeDashboardTab;
