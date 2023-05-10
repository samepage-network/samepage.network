import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form } from "@remix-run/react";
import Button from "package/components/Button";
import TextInput from "package/components/TextInput";
import NumberInput from "~/components/NumberInput";
import remixAdminAction from "~/data/remixAdminAction.server";
import remixAdminLoader from "~/data/remixAdminLoader.server";

export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const PadawanAdminPage = () => {
  return (
    <Form method="post">
      <TextInput name={"owner"} defaultValue={"dvargas92495"} />
      <TextInput name={"repo"} defaultValue={"roamjs-smartblocks"} />
      <NumberInput name={"issue"} defaultValue={63} />
      <Button>Assign</Button>
    </Form>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId } }) => {});
};

export const action: ActionFunction = async (args) => {
  return remixAdminAction(args, {
    POST: async ({ context: { requestId }, data }) => {},
  });
};

export const handle = {
  Title: "Padawan",
};
export default PadawanAdminPage;
