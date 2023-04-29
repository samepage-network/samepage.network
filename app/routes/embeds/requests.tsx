import { LoaderArgs, redirect } from "@remix-run/node";
import getMysql from "~/data/mysql.server";
import authenticateEmbed from "./_authenticateEmbed";

const RequestsEmbed = () => {
  return <div>Coming Soon...</div>;
};

export const loader = async (args: LoaderArgs) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    await getMysql(result.requestId).then((c) => c.end());
    return redirect("/embeds");
  }
  return { auth: true };
};

export default RequestsEmbed;
