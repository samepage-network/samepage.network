import { ActionFunction, redirect } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import React, { useEffect, useState } from "react";
import getMysql from "~/data/mysql.server";
import { apps, notebooks, tokenNotebookLinks } from "data/schema";
import parseRemixContext from "~/data/parseRemixContext.server";
import { BadRequestResponse } from "~/data/responses.server";
import HomeDashboardTab, {
  makeLoader,
} from "samepage/components/HomeDashboardTab";
import { and, eq } from "drizzle-orm/expressions";
import verifyUser from "~/data/verifyUser.server";
import authenticateNotebook from "~/data/authenticateNotebook.server";
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

export const loader = makeLoader({ authenticateNotebook });

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
  const requestId = parseRemixContext(args.context).lambdaContext.awsRequestId;
  const tokenRecord = await verifyUser({ email, password, requestId });
  const cxn = await getMysql(requestId);
  const appRecords = await cxn
    .select({ id: apps.id, originRegex: apps.originRegex })
    .from(apps);
  const thisApp = appRecords.find((app) =>
    new RegExp(app.originRegex).test(origin)
  );
  const [notebookRecord] = !thisApp
    ? await cxn
        .select({
          uuid: tokenNotebookLinks.uuid,
        })
        .from(tokenNotebookLinks)
        .where(eq(tokenNotebookLinks.tokenUuid, tokenRecord.uuid))
        .limit(1)
    : await cxn
        .select({
          uuid: tokenNotebookLinks.uuid,
        })
        .from(tokenNotebookLinks)
        .innerJoin(
          notebooks,
          eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
        )
        .where(
          and(
            eq(tokenNotebookLinks.tokenUuid, tokenRecord.uuid),
            eq(notebooks.app, thisApp.id)
          )
        );
  await cxn.end();
  if (!notebookRecord) {
    return redirect(
      `/embeds?user_auth=${Buffer.from(
        `${tokenRecord.userId}:${tokenRecord.value}`
      ).toString("base64")}`
    );
  }
  return redirect(
    `/embeds?auth=${Buffer.from(
      `${notebookRecord.uuid}:${tokenRecord.value}`
    ).toString("base64")}`
  );
};

export default EmbedsIndexPage;
