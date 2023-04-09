import type { WSHandler } from "./sendmessage";
import debug from "package/utils/debugger";
// import emailError from "~/data/emailError.server";
// import getMysqlConnection from "~/data/mysql.server";

const log = debug("onconnect");

export const handler: WSHandler = (event) => {
  const id = event.requestContext?.connectionId || "";
  // Do we even _need_ to do anything on connect?
  //
  // We can create the record on authenticate and be done with it. Commented this out
  // bc of mysql connection race condition issues. Also creating a null record was weird
  //
  // return getMysqlConnection()
  //   .then(async (cxn) => {
  //     await cxn.execute(
  //       `INSERT INTO online_clients (id, notebook_uuid, created_date)
  //   VALUES (?,?,?,?)`,
  //       [id, "", 0, new Date()]
  //     );
  //     cxn.destroy();
  return Promise.resolve()
    .then(() => {
      log("connected new client", id);
      return { statusCode: 200, body: "Connected" };
    })
    .catch(
      () =>
        // e
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
