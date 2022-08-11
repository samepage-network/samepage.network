import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import APPS from "~/enums/apps";

const logic = () => ({ apps: APPS });

export const handler = createAPIGatewayProxyHandler(logic);
