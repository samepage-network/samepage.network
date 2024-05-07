import { v4 } from "uuid";
import getMysql from "./mysql.server";
import { employees, employeesHistory } from "data/schema";
import { z } from "zod";
import { EC2 } from "@aws-sdk/client-ec2";
import { InternalServerError } from "~/data/errors.server";
import AES from "crypto-js/aes";

const ec2 = new EC2({});
const UBUNTU_SERVER_22_04_LTS = "ami-080e1f13689e07408";

const createUserSchema = z.object({
  name: z
    .string()
    .array()
    .refine((names) => names.length > 0)
    .transform((names) => names[0]),
  title: z
    .string()
    .array()
    .refine((titles) => titles.length > 0)
    .transform((titles) => titles[0]),
});

const createUserEmployee = async ({
  requestId,
  data,
  userId,
}: {
  requestId: string;
  data: Record<string, string[]>;
  userId: string;
}) => {
  const cxn = await getMysql(requestId);

  const formData = createUserSchema.parse(data);
  const uuid = v4();
  const hiredDate = new Date();

  const keyPair = await ec2.createKeyPair({
    KeyName: uuid,
    KeyFormat: "pem",
    KeyType: "rsa",
  });

  if (!keyPair.KeyMaterial) {
    throw new InternalServerError("Failed to create key pair");
  }

  const instance = await ec2.runInstances({
    ImageId: UBUNTU_SERVER_22_04_LTS,
    KeyName: keyPair.KeyName,
    MaxCount: 1,
    MinCount: 1,
  });

  const instanceId = instance.Instances?.[0]?.InstanceId;
  if (!instanceId) {
    throw new InternalServerError("Failed to create instance");
  }

  const sshPrivateKey = AES.encrypt(
    keyPair.KeyMaterial,
    process.env.ENCRYPTION_KEY
  ).toString();

  await cxn.insert(employees).values({
    uuid,
    name: formData.name,
    title: formData.title,
    userId,
    hiredDate,
    instanceId,
    sshPrivateKey,
  });

  await cxn.insert(employeesHistory).values({
    uuid,
    name: formData.name,
    title: formData.title,
    userId,
    hiredDate,
    historyUser: userId,
    historyDate: hiredDate,
    instanceId,
    sshPrivateKey,
  });

  await cxn.end();
  return { employeeUuid: uuid };
};

export default createUserEmployee;
