import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import type { AppId } from "./enums/apps";

export type WSEvent = Pick<APIGatewayProxyEvent, "body"> & {
  requestContext: Pick<APIGatewayProxyEvent["requestContext"], "connectionId">;
};

export type WSHandler = (
  event: WSEvent,
  context: Pick<Context, "awsRequestId">
) => Promise<APIGatewayProxyResult>;

// @todo - replace with atjson
type ViewType = "document" | "bullet" | "numbered";
type TextAlignment = "left" | "center" | "right";
type ActionParams = {
  location?: {
    "parent-uid": string;
    order: number;
  };
  block?: {
    string?: string;
    uid?: string;
    open?: boolean;
    heading?: number;
    "text-align"?: TextAlignment;
    "children-view-type"?: ViewType;
  };
  page?: {
    title?: string;
    uid?: string;
  };
};

export type Action = {
  action: "createBlock" | "updateBlock" | "deleteBlock";
  params: ActionParams;
};

export type Notebook = { workspace: string; app: AppId };
