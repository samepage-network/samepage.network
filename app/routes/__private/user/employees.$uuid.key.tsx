import { LoaderFunction } from "@remix-run/node";
import { BadRequestError } from "~/data/errors.server";
import remixAppLoader from "~/data/remixAppLoader.server";
import retrieveUserEmployeePrivateKey from "~/data/retrieveUserEmployeePrivateKey.server";

export const loader: LoaderFunction = async (args) => {
  return remixAppLoader(args, async ({ params, userId, requestId }) => {
    if (!params.uuid) {
      throw new BadRequestError("Employee UUID is required");
    }
    const privateKey = await retrieveUserEmployeePrivateKey({
      requestId,
      employeeUuid: params.uuid,
      userId,
    });
    return new Response(privateKey, {
      status: 200,
      headers: {
        "Content-Type": "application/x-pem-file",
        ContentDisposition: `attachment; filename=${params.uuid}.pem`,
      },
    });
  });
};
