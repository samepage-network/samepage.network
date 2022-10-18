import { BadRequestError } from "@dvargas92495/app/backend/errors.server";
import getMysqlConnection from "fuegojs/utils/mysql";

const deleteToken = async ({
  context: { requestId },
  data,
}: {
  data: Record<string, string[]>;
  context: { requestId: string };
}) => {
  const uuid = data["uuid"]?.[0];
  if (!uuid) throw new BadRequestError(`Token \`uuid\` is required.`);
  const cxn = await getMysqlConnection(requestId);
  await cxn.execute(`DELETE FROM token_notebook_links WHERE token_uuid = ?`, [
    uuid,
  ]);
  await cxn.execute(`DELETE FROM tokens WHERE uuid = ?`, [uuid]);
  cxn.destroy();
  return {
    success: true,
  };
};

export default deleteToken;
