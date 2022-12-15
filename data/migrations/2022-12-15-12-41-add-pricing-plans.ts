import type { MigrationProps } from "fuegojs/types";
import QUOTAS from "~/data/quotas.server";

export const migrate = async (args: MigrationProps) => {
  const PAGES = QUOTAS.indexOf("Pages");
  const NOTEBOOKS = QUOTAS.indexOf("Notebooks");
  return args.connection.execute(
    `INSERT INTO quotas (uuid, field, value, stripe_id) 
     VALUES (UUID(), ?, ?, ?), (UUID(), ?, ?, ?), (UUID(), ?, ?, ?), (UUID(), ?, ?, ?)`,
    [
      PAGES,
      1000,
      "price_1MFLQsAwmvpmkmv4fGoEheh0",
      NOTEBOOKS,
      5,
      "price_1MFLQsAwmvpmkmv4fGoEheh0",
      PAGES,
      10000,
      "price_1MFLQmAwmvpmkmv4zCPlQnIf",
      NOTEBOOKS,
      8,
      "price_1MFLQmAwmvpmkmv4zCPlQnIf",
    ]
  );
};

export const revert = () => {
  return Promise.resolve();
};
