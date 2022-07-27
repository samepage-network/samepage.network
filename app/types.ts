import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends Record<string, unknown>
    ? RecursivePartial<T[P]>
    : T[P];
};

export type WSEvent = RecursivePartial<APIGatewayProxyEvent>;

export type WSHandler = (event: WSEvent) => Promise<APIGatewayProxyResult>;

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
