import { employees } from "data/schema";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "./errors.server";
import getMysql from "./mysql.server";
import { eq } from "drizzle-orm/expressions";

const fireUserEmployee = async ({
  userId,
  employeeId,
  requestId,
}: {
  userId: string;
  employeeId?: string;
  requestId: string;
}) => {
  if (!employeeId) {
    throw new BadRequestError("Employee ID is required");
  }

  const cxn = await getMysql(requestId);
  const [employee] = await cxn
    .select({ uuid: employees.uuid, userId: employees.userId })
    .from(employees)
    .where(eq(employees.uuid, employeeId));
  if (!employee) {
    throw new NotFoundError("Employee not found");
  }

  if (employee.userId !== userId) {
    throw new ForbiddenError(
      "You do not have permission to fire this employee"
    );
  }

  // DELETE employee

  return { success: true };
};

export default fireUserEmployee;
