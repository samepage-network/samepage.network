import type { WSHandler } from "~/types";
// import emailError from "@dvargas92495/app/backend/emailError.server";
import getMysqlConnection from "@dvargas92495/app/backend/mysql.server";

export const handler: WSHandler = (event) => {
  const id = event.requestContext?.connectionId || "";
  return getMysqlConnection()
    .then(async (cxn) => {
      await cxn.execute(
        `INSERT INTO online_clients (id, instance, app, created_date)
    VALUES (?,?,?,?)`,
        [id, "", 0, new Date()]
      );
      cxn.destroy();
    })
    .then(() => ({ statusCode: 200, body: "Connected" }))
    .catch(
      (
        // e
      ) =>
        // emailError(
        //   `Multiplayer OnConnect Failure: ${id}`,
        //   e
        // ).then((id) =>
        {
          return {
            statusCode: 500,
            body: `Failed to connect: ${id}`,
          };
        }
      //)
    );
};
