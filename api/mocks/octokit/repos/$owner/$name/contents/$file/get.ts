import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { NotFoundError } from "~/data/errors.server";
import path from "path";
import fs from "fs";

const logic = ({
  name,
  owner,
  file,
}: {
  name: string;
  owner: string;
  file: string;
}) => {
  if (owner !== "samepage-network") {
    throw new NotFoundError(`Owner ${owner} not found`);
  }
  const fileName = path.join("..", name, file);
  if (!fs.existsSync(fileName)) {
    throw new NotFoundError(`File ${fileName} not found`);
  }
  const content = fs.readFileSync(fileName, "base64");
  return { content, type: "file" };
};

export default createAPIGatewayProxyHandler(logic);
