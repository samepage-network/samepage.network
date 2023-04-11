import { ActionFunction } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { accessTokens, apps, notebooks, pageNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { apiPost } from "package/internal/apiClient";
import React from "react";
import Button from "~/components/Button";
import getMeta from "~/components/getMeta";
import TextInput from "~/components/TextInput";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import getMysql from "~/data/mysql.server";
import Automerge from "automerge";
import unwrapSchema from "package/utils/unwrapSchema";

const EmbedPage: React.FC = () => {
  return (
    <Form method={"post"}>
      <h1 className="text-3xl font-bold mb-8">
        SamePage{" "}
        <img
          src={"https://samepage.network/images/logo.png"}
          className={"inline h-12 w-12"}
        />
      </h1>
      <TextInput name={"page"} label={"Page Name"} />
      <Button>Trigger "Example Cross Application Workflow"</Button>
    </Form>
  );
};

export const handle = {
  skipClerk: true,
};
export const action: ActionFunction = async ({ request }) => {
  const data = await request.formData();
  const workflow = "f1a38607-4d88-474b-9981-9bd9f30ceb83";
  const page = data.get("page");
  const cxn = await getMysql();
  const [record] = await cxn
    .select({
      cid: pageNotebookLinks.cid,
      isPublic: pageNotebookLinks.isPublic,
    })
    .from(pageNotebookLinks)
    .where(eq(pageNotebookLinks.uuid, workflow));
  const [{ authorization, app }] = await cxn
    .select({
      authorization: accessTokens.value,
      app: apps.code,
    })
    .from(accessTokens)
    .innerJoin(notebooks, eq(accessTokens.notebookUuid, notebooks.uuid))
    .innerJoin(apps, eq(apps.id, notebooks.app))
    .where(
      eq(accessTokens.notebookUuid, "a6681698-14d7-43e2-8466-0314213c384c")
    );
  const { body } = await downloadSharedPage({ cid: record.cid });
  const { data: notebookPageId } = await apiPost({
    path: `extensions/${app}/backend`,
    data: {
      type: "CREATE_PAGE",
      data: {
        notebookPageId: page,
        path: "Getting-Started-73dc4bf6a0e74a07adc25798a2f5b468",
      },
    },
    authorization,
  });
  const state = unwrapSchema(Automerge.load(body));
  state.content = state.content.replace("<%DATE:today%>", "April 07, 2023");
  await apiPost({
    path: `extensions/${app}/backend`,
    data: {
      type: "APPLY_STATE",
      data: {
        notebookPageId,
        state,
      },
    },
    authorization,
  });
  return { success: true };
};
export const meta = getMeta({ title: "Embed" });
export default EmbedPage;
