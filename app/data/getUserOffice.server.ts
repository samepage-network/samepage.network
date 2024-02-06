import getMysql from "~/data/mysql.server";

const getUserNotebookProfile = async ({
  context: { requestId },
  params: { uuid = "" },
}: {
  params: Record<string, string | undefined>;
  context: { requestId: string };
}) => {
  const cxn = await getMysql(requestId);
  // TODO: Get stuff from postgres
  await cxn.end();
  return {
    uuid,
    name: "Research Notebook",
    description: "A place to Search, Summarize, and Analyze my research.",
  };
};

export default getUserNotebookProfile;
