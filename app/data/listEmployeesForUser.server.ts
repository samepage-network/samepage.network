import { employees } from "data/schema";
import getMysql from "./mysql.server";
import { eq } from "drizzle-orm";

const listEmployeesForUser = async ({
  userId,
  requestId,
}: {
  userId: string;
  requestId: string;
}) => {
  const cxn = await getMysql(requestId);
  const userEmployees = await cxn
    .select({
      uuid: employees.uuid,
      name: employees.name,
      title: employees.title,
    })
    .from(employees)
    .where(eq(employees.userId, userId))
    .orderBy(employees.hiredDate);
  return {
    data: userEmployees,
  };
};

export default listEmployeesForUser;
