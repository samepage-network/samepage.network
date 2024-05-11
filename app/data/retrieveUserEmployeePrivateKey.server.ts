import AES from "crypto-js/aes";
import encutf8 from "crypto-js/enc-utf8";
import getMysql from "./mysql.server";
import { employees } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { ForbiddenError, NotFoundError } from "./errors.server";

const retrieveUserEmployeePrivateKey = async ({
  requestId,
  employeeUuid,
  userId,
}: {
  requestId: string;
  employeeUuid: string;
  userId: string;
}): Promise<string> => {
  const cxn = await getMysql(requestId);

  const employeeInfo = await cxn
    .select({
      key: employees.sshPrivateKey,
      ownerId: employees.userId,
    })
    .from(employees)
    .where(eq(employees.uuid, employeeUuid));

  if (!employeeInfo.length) {
    throw new NotFoundError("Employee not found");
  }

  const [{ key, ownerId }] = employeeInfo;
  if (ownerId !== userId) {
    throw new ForbiddenError("Employee not found");
  }

  const privateKey = AES.decrypt(key, process.env.ENCRYPTION_KEY).toString(
    encutf8
  );

  await cxn.end();
  return privateKey;
};

export default retrieveUserEmployeePrivateKey;
