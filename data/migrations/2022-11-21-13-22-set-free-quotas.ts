import type { MigrationProps } from "fuegojs/types";
import QUOTAS from "~/data/quotas.server";

export const migrate = async (args: MigrationProps) => {
  return args.connection.execute(
    `INSERT INTO quotas (uuid, field, value) VALUES (UUID(), ?, ?), (UUID(), ?, ?)`,
    [QUOTAS.indexOf("Pages"), 100, QUOTAS.indexOf("Notebooks"), 3]
  );
};

export const revert = () => {
  return Promise.resolve();
};
