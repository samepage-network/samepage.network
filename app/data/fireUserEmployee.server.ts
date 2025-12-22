import { employees } from "data/schema";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "./errors.server";
import getMysql from "./mysql.server";
import { eq } from "drizzle-orm";
import { EC2 } from "@aws-sdk/client-ec2";

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
    .select({
      uuid: employees.uuid,
      userId: employees.userId,
      instanceId: employees.instanceId,
    })
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

  const ec2 = new EC2({});
  await ec2.terminateInstances({ InstanceIds: [employee.instanceId] });

  await cxn.delete(employees).where(eq(employees.uuid, employeeId));

  return { success: true };
};

export default fireUserEmployee;
