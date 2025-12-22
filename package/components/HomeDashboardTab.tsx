import React from "react";
import {
  ActionFunctionArgs,
  Form,
  Link,
  LoaderFunctionArgs,
  useLoaderData,
  redirect,
  useSearchParams,
} from "react-router-dom";
import Button from "./Button";
import TextInput from "./TextInput";
import BaseInput from "./BaseInput";
import { ListUserNotebooks } from "../internal/types";
import { BadRequestResponse, NotFoundResponse } from "../utils/responses";
import base64 from "../internal/base64";
import parseCredentialsFromRequest from "../internal/parseCredentialsFromRequest";
import apiClient from "../internal/apiClient";

const HomeDashboardTab = ({ url }: { url: string }): React.ReactElement => {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const [searchParams] = useSearchParams();
  return (
    <div className="flex flex-col h-full">
      {searchParams.get("warning") === "not-logged-in" && (
        <div className="mb-4 bg-yellow-300 border-yellow-800 rounded-xl font-semibold p-4 shadow-2xl">
          Warning: Please first log in to your SamePage account to access the
          other tabs.
        </div>
      )}
      <h1 className="font-bold mb-4 text-xl">SamePage</h1>
      <div className="mb-2">
        This widget helps you manage all your SamePage related resources!
      </div>
      {!data.auth ? (
        <Form method={"post"} className="pb-8">
          <div className="mb-2">
            Log into your SamePage account to get started.
          </div>
          <TextInput
            name={"email"}
            label={"Email"}
            placeholder="mclicks+samepage@gmail.com"
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
        </div>
      )}
    </div>
  );
};

export const loader = async (args: LoaderFunctionArgs) => {
  const result = parseCredentialsFromRequest(args);
  if (!result.auth) {
    return {
      auth: false as const,
    };
  }
  const { notebooks } = await apiClient<Awaited<ReturnType<ListUserNotebooks>>>(
    {
      method: "list-user-notebooks",
      // TODO - get from clerk
      // userId: result.notebookUuid,
      userId: "",
      token: result.token,
    }
  );
  return {
    auth: true as const,
    notebookUuid: result.notebookUuid,
    token: result.token,
    notebooks,
  };
};

export const action = async (args: ActionFunctionArgs) => {
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
  const authenticatedUser = await apiClient({
    method: "authenticate-user",
    email,
    password,
    origin,
  });
  if (!("notebookUuid" in authenticatedUser)) {
    return redirect(
      `?user_auth=${base64(
        `${authenticatedUser.userId}:${authenticatedUser.token}`
      )}`
    );
  }
  return redirect(
    `?auth=${base64(
      `${authenticatedUser.notebookUuid}:${authenticatedUser.token}`
    )}`
  );
};

export default HomeDashboardTab;
