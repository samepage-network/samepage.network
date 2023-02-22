import type { MigrationProps } from "fuegojs/types";

export const migrate = async (args: MigrationProps) => {
  return args.connection.execute(
    `UPDATE tokens t 
    INNER JOIN invitations i ON i.token_uuid = t.uuid
    SET t.created_date = i.created_date`,
    []
  );
};

export const revert = () => {
  return Promise.resolve();
};
