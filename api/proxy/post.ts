import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import {
  BadRequestError,
  InternalServorError,
  NotFoundError,
} from "@dvargas92495/app/backend/errors.server";
import axios from "axios";

const logic = ({
  url,
  method,
  headers,
  body,
}: {
  url: string;
  headers: Record<string, string>;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;
}) => {
  return axios({ url, method, headers, data: body && JSON.parse(body) })
    .then((r) => r.data)
    .catch((r) => {
      const msg = r.response.data
        ? JSON.stringify(r.response.data)
        : r.response.statusText;
      if (r.response.status === 400) {
        throw new BadRequestError(msg);
      } else if (r.response.status === 404) {
        throw new NotFoundError(msg);
      } else {
        throw new InternalServorError(msg);
      }
    });
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/^chrome-extension:\/\//],
});
