import { ActionFunction, LoaderArgs, redirect } from "@remix-run/node";
import React from "react";
import authenticateEmbed from "./_authenticateEmbed";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import TextInput from "~/components/TextInput";
import BaseInput from "~/components/BaseInput";
import Button from "~/components/Button";
import {
  BadRequestResponse,
  ForbiddenResponse,
  NotFoundResponse,
  UnauthorizedResponse,
} from "~/data/responses.server";
import { users } from "@clerk/clerk-sdk-node";
import listApps from "~/data/listApps.server";
import getMysql from "~/data/mysql.server";
import Select from "~/components/Select";
import parseRemixContext from "~/data/parseRemixContext.server";
import {
  apps,
  notebooks,
  pageNotebookLinks,
  pageProperties,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import AtJsonRendered from "package/components/AtJsonRendered";
import { zSamePageSchema } from "package/internal/types";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const SharedPagesEmbedPage: React.FC = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  const [params] = useSearchParams();
  return (
    <div>
      {!data.auth && (
        <Form action={"post"}>
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
            name={"app"}
            options={data.apps.map((a) => ({
              label: a.name,
              id: a.code,
            }))}
          />
          <Button>Log In</Button>
        </Form>
      )}
      {data.auth && (
        <ul>
          {data.pages.map((p) => (
            <li key={p.notebookPageId}>
              <Link to={`${p.notebookPageId}?auth=${params.get("auth")}`}>
                <AtJsonRendered {...p.title} />
              </Link>
            </li>
          ))}
        </ul>
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
  const cxn = await getMysql(result.requestId);
  const pages = await cxn
    .select({
      notebookPageId: pageNotebookLinks.notebookPageId,
      title: pageProperties.value,
    })
    .from(pageNotebookLinks)
    .innerJoin(
      pageProperties,
      eq(pageProperties.linkUuid, pageNotebookLinks.uuid)
    )
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, notebooks.uuid),
        eq(pageProperties.key, "$title")
      )
    );
  await cxn.end();
  return {
    auth: true as const,
    pages: pages.map((p) => ({
      notebookPageId: p.notebookPageId,
      title: zSamePageSchema.parse(p.title),
    })),
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
      eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
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
    `/embeds/shared-pages?auth=${Buffer.from(
      `${auth.notebookUuid}:${auth.token}`
    ).toString("base64")}`
  );
};

export default SharedPagesEmbedPage;
