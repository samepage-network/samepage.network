import { downloadFileContent } from "@dvargas92495/app/backend/downloadFile.server";
import type { MigrationProps } from "fuegojs/types";

export const migrate = (args: MigrationProps) => {
  return args.connection
    .execute(`SELECT uuid FROM messages WHERE operation = ""`)
    .then(([msgs]) => {
      return (msgs as { uuid: string }[])
        .map(
          (msg) => () =>
            downloadFileContent({ Key: `data/messages/${msg.uuid}.json` })
              .then((content) => {
                if (!content) {
                  return args.connection.execute(
                    `DELETE FROM messages WHERE uuid = ?`,
                    [msg.uuid]
                  );
                }
                const { operation, ...rest } = JSON.parse(content);
                return args.connection
                  .execute(`UPDATE messages SET operation = ? WHERE uuid = ?`, [
                    operation,
                    msg.uuid,
                  ])
                  .then(async (res) => {
                    if (operation === "SHARE_PAGE") {
                      return args.connection.execute(
                        `UPDATE messages SET metadata = ? WHERE uuid = ?`,
                        [{ title: rest.notebookPageId }, msg.uuid]
                      );
                    }
                    return res;
                  });
              })
              .then(() => {
                console.log("migrated", msg.uuid);
              })
              .catch((e) => {
                console.log("failed to migrate", msg.uuid);
                console.error(e);
              })
        )
        .reduce((p, c) => p.then(c), Promise.resolve());
    });
};

export const revert = (args: MigrationProps) => {
  return args.connection.execute(`UPDATE messages SET operation = ""`, []);
};
