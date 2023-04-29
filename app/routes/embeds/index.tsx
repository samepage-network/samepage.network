import { ActionFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigate } from "@remix-run/react";
import React from "react";
import BaseInput from "~/components/BaseInput";
import Button from "~/components/Button";
import Select from "~/components/Select";
import TextInput from "~/components/TextInput";
import authenticateEmbed from "./_authenticateEmbed";
import listApps from "~/data/listApps.server";
import getMysql from "~/data/mysql.server";
import { users } from "@clerk/clerk-sdk-node";
import { tokens, tokenNotebookLinks, apps, notebooks } from "data/schema";
import { eq, and } from "drizzle-orm/expressions";
import parseRemixContext from "~/data/parseRemixContext.server";
import {
  BadRequestResponse,
  NotFoundResponse,
  UnauthorizedResponse,
  ForbiddenResponse,
} from "~/data/responses.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const EmbedsIndexPage: React.FC = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  const navigate = useNavigate();
  if (typeof document !== "undefined") {
    console.log("referer", document.referrer);
    console.log("ao", document.location?.ancestorOrigins?.[0]);
  }
  return (
    <div>
      <h1 className="font-bold mb-4 text-xl">SamePage Widget</h1>
      <div className="mb-2">
        This widget helps you manage all your SamePage related resources!
      </div>
      {!data.auth ? (
        <Form method={"post"}>
          <div className="mb-2">
            Log into your SamePage account and pick the current application to
            get started.
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
          <Select
            label="Application"
            name={"app"}
            options={data.apps.map((a) => ({
              label: a.name,
              id: a.code,
            }))}
          />
          <Button>Log In</Button>
        </Form>
      ) : (
        <div>
          <div className="mb-2">
            Successfully logged in! Click on one of the resources on the left to
            get started.
          </div>
          <Button type={"button"} onClick={() => navigate("/embeds")}>
            Log Out
          </Button>
        </div>
      )}
    </div>
  );
};

export const loader = async (args: LoaderArgs) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    const apps = await listApps({ requestId: result.requestId });
    await getMysql(result.requestId).then((c) => c.end());
    return {
      auth: false as const,
      apps,
    };
  }
  return {
    auth: true as const,
  };
};

export const action: ActionFunction = async (args) => {
  const data = await args.request.formData();
  const email = data.get("email");
  const password = data.get("password");
  const app = data.get("app");
  if (typeof email !== "string") {
    throw new BadRequestResponse("Missing email");
  }
  if (typeof password !== "string") {
    throw new BadRequestResponse("Missing password");
  }
  if (typeof app !== "string") {
    throw new BadRequestResponse("Missing app");
  }
  const [user] = await users.getUserList({ emailAddress: [email] });
  if (!user) {
    throw new NotFoundResponse(`No user exists with email ${email}`);
  }
  const { verified } = await users.verifyPassword({
    userId: user.id,
    password,
  });
  if (!verified) {
    throw new UnauthorizedResponse("Invalid password");
  }
  const requestId = parseRemixContext(args.context).lambdaContext.awsRequestId;
  const cxn = await getMysql(requestId);
  const [auth] = await cxn
    .select({
      notebookUuid: notebooks.uuid,
      token: tokens.value,
    })
    .from(tokens)
    .innerJoin(
      tokenNotebookLinks,
      eq(tokenNotebookLinks.tokenUuid, tokens.uuid)
    )
    .innerJoin(notebooks, eq(notebooks.uuid, tokenNotebookLinks.notebookUuid))
    .innerJoin(apps, eq(notebooks.app, apps.id))
    .where(and(eq(tokens.userId, user.id), eq(apps.code, app)));
  await cxn.end();
  if (!auth) {
    throw new ForbiddenResponse(
      `You have not yet installed SamePage to this application. Learn how at https://samepage.network/install?code=${app}`
    );
  }
  return redirect(
    `/embeds?auth=${Buffer.from(`${auth.notebookUuid}:${auth.token}`).toString(
      "base64"
    )}`
  );
};

export default EmbedsIndexPage;
