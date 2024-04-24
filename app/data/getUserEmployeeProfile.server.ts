import { employees } from "data/schema";
import getMysql from "./mysql.server";
import { and, eq } from "drizzle-orm/expressions";
import { NotFoundError } from "./errors.server";
import { z } from "zod";

const getUserEmployeeProfileSchema = z.object({
  uuid: z.string(),
});

const getUserEmployeeProfile = async ({
  requestId,
  params,
  userId,
}: {
  requestId: string;
  params: Record<string, string | undefined>;
  userId: string;
}) => {
  const { uuid } = getUserEmployeeProfileSchema.parse(params);
  const cxn = await getMysql(requestId);
  const [employee] = await cxn
    .select({
      title: employees.title,
      name: employees.name,
      instanceId: employees.instanceId,
    })
    .from(employees)
    .where(and(eq(employees.uuid, uuid), eq(employees.userId, userId)));
  const responsibilities: { uuid: string }[] = [];
  await cxn.end();
  if (!employee) {
    throw new NotFoundError("Employee not found");
  }
  return { employee, responsibilities };
};

export default getUserEmployeeProfile;
