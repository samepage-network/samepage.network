import { employees } from "data/schema";
import getMysql from "./mysql.server";
import { and, eq } from "drizzle-orm/expressions";
import { NotFoundError } from "./errors.server";
import { z } from "zod";
import { EC2 } from "@aws-sdk/client-ec2";

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
  const [employeeRecord] = await cxn
    .select({
      title: employees.title,
      name: employees.name,
      instanceId: employees.instanceId,
    })
    .from(employees)
    .where(and(eq(employees.uuid, uuid), eq(employees.userId, userId)));
  const responsibilities: { uuid: string }[] = [];
  await cxn.end();
  if (!employeeRecord) {
    throw new NotFoundError("Employee not found");
  }

  const ec2 = new EC2({});
  const { instanceId, ...employee } = employeeRecord;
  const output = await ec2.describeInstances({
    InstanceIds: [employeeRecord.instanceId],
  });
  const instance = output.Reservations?.[0]?.Instances?.[0];
  if (!instance) {
    throw new NotFoundError("Employee instance not found");
  }

  return {
    ...employee,
    uuid,
    responsibilities,
    instance: {
      id: instanceId,
      state: instance.State?.Name,
      ipAddress: instance.PublicIpAddress,
      dnsName: instance.PublicDnsName,
      username: "ubuntu",
    },
  };
};

export default getUserEmployeeProfile;
