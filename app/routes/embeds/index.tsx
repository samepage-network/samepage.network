import { ActionFunction, LoaderArgs, redirect } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import React, { useEffect, useState } from "react";
import authenticateEmbed from "./_authenticateEmbed.server";
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
import HomeDashboardTab from "package/components/HomeDashboardTab";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const EmbedsIndexPage: React.FC = () => {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof document !== "undefined") {
      setOrigin(document.location?.ancestorOrigins?.[0] || "");
    }
  }, [setOrigin]);
  return <HomeDashboardTab onLogOut={() => navigate("/embeds")} url={origin} />;
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
  const origin = data.get("origin");
  if (typeof email !== "string") {
    throw new BadRequestResponse("Missing email");
  }
  if (typeof password !== "string") {
    throw new BadRequestResponse("Missing password");
  }
  if (typeof origin !== "string") {
    throw new BadRequestResponse("Missing origin");
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
  const [app] = await cxn
    .select({ code: apps.code, originRegex: apps.originRegex })
    .from(apps)
    .then((all) =>
      all.filter((app) => new RegExp(app.originRegex).test(origin))
    );
  if (!app) {
    throw new BadRequestResponse(
      `Widget is currently in an unsupported domain: ${origin}`
    );
  }
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
    .where(and(eq(tokens.userId, user.id), eq(apps.code, app.code)));
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
