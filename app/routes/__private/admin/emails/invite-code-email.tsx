import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import randomString from "~/data/randomString.server";
import InviteCodeEmail from "~/components/InviteCodeEmail";

const InviteCodeEmailPage = () => {
  const { code } = useLoaderData<{ code: string }>();
  return (
    <>
      <InviteCodeEmail code={code} />
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, async () => ({
    code: await randomString({ length: 4, encoding: "hex" }),
  }));
};

export default InviteCodeEmailPage;
