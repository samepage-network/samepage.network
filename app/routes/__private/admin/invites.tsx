import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form, useSubmit } from "@remix-run/react";
import { useState, useEffect } from "react";
import Table from "@dvargas92495/app/components/Table";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import listIssuedTokens from "~/data/listIssuedTokens.server";
import issueNewToken from "~/data/issueNewToken.server";
import Button from "@dvargas92495/app/components/Button";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
import deleteToken from "~/data/deleteToken.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const InvitesPage = () => {
  const submit = useSubmit();
  const [shiftKey, setShiftKey] = useState(false);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      setShiftKey(e.shiftKey);
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, [setShiftKey]);
  return (
    <>
      <Form method={"post"}>
        <Button>New</Button>
      </Form>
      <Table
        className="max-w-3xl w-full mt-8"
        onRowClick={(r) =>
          shiftKey
            ? submit({ uuid: r.uuid as string }, { method: "delete" })
            : window.navigator.clipboard.writeText(r.token as string)
        }
      />
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId } }) =>
    listIssuedTokens(requestId)
  );
};

export const action: ActionFunction = (args) => {
  return remixAdminAction(args, { POST: issueNewToken, DELETE: deleteToken });
};

export default InvitesPage;
