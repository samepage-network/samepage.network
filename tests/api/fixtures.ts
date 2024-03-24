import { v4 } from "uuid";
import { test } from "@playwright/test";
import type { APIGatewayProxyHandler } from "aws-lambda";

type UrlOrPredicate = string | RegExp | ((input: Request) => boolean);
type MockParams = {
  status?: number;
  statusText?: string;
  headers?: string[][] | { [key: string]: string };
  url?: string;
};

const givenReader = (
  chunks: (string | Record<string, unknown>)[]
): ReadableStreamReader<Uint8Array> => {
  const chunkQueue = chunks.slice();
  const read = () => {
    const chunk = chunkQueue.shift();
    if (chunk) {
      return Promise.resolve({
        done: false as const,
        value: new TextEncoder().encode(
          typeof chunk === "string" ? chunk : JSON.stringify(chunk)
        ),
      });
    } else {
      return Promise.resolve({
        done: true as const,
        value: new TextEncoder().encode(""),
      });
    }
  };
  const reader = {
    read,
    releaseLock: () => {},
    closed: Promise.resolve(undefined),
    cancel: () => Promise.resolve(),
  };
  return reader;
};

const cachedMocks = new Set<{
  urlOrPredicate: UrlOrPredicate;
  response: string | ReadableStream<Uint8Array>;
  responseInit?: MockParams;
}>();

export const fetchMockIf = (
  urlOrPredicate: UrlOrPredicate,
  body: string | string[],
  responseInit?: MockParams
) => {
  if (Array.isArray(body)) {
    const getResponse = (): ReadableStream<Uint8Array> => {
      const res: ReadableStream<Uint8Array> = {
        locked: true,
        cancel: () => Promise.resolve(),
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        getReader: () => givenReader(body),
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        pipeThrough: () => {},
        pipeTo: () => Promise.resolve(),
        tee: () => [getResponse(), getResponse()],
      };
      return res;
    };
    cachedMocks.add({ urlOrPredicate, response: getResponse(), responseInit });
  } else {
    cachedMocks.add({ urlOrPredicate, response: body, responseInit });
  }
};

const mockResponse = async (
  req: Request
): Promise<{
  body: string | ReadableStream<Uint8Array>;
  init: {
    status: number;
    headers: Record<string, string>;
  };
}> => {
  const url = req.url.toString();
  const cachedMock = Array.from(cachedMocks).find((mock) => {
    if (mock.urlOrPredicate instanceof RegExp) {
      return mock.urlOrPredicate.test(url);
    } else if (typeof mock.urlOrPredicate === "string") {
      return mock.urlOrPredicate === url;
    } else {
      return mock.urlOrPredicate(req);
    }
  });
  if (cachedMock) {
    const cachedHeaders = Array.isArray(cachedMock.responseInit?.headers)
      ? {}
      : cachedMock.responseInit?.headers || {};
    return {
      body: cachedMock.response,
      init: {
        status: 200,
        ...cachedMock.responseInit,
        headers: {
          "Content-Type": "application/json",
          ...cachedHeaders,
        },
      },
    };
  }
  console.warn("Unexpected fetch request", url, req.method, req.body);
  return {
    body: JSON.stringify({
      detail: `Mock missing for request: ${req.method} ${url}`,
    }),
    init: { status: 500, headers: {} },
  };
};

const abort = () =>
  new DOMException("The operation was aborted. ", "AbortError");

const normalizeRequest = (
  input: Parameters<typeof global.fetch>[0],
  reqInit: Parameters<typeof global.fetch>[1]
) => {
  if (input instanceof Request) {
    if (input.signal && input.signal.aborted) {
      abort();
    }
    return input;
  } else if (typeof input === "string") {
    if (reqInit && reqInit.signal && reqInit.signal.aborted) {
      abort();
    }
    return new Request(input, reqInit);
  } else {
    throw new TypeError("Unable to parse input as string or Request");
  }
};

// Should only be called in `setup.ts`
export const setupFetchMock = () => {
  cachedMocks.clear();

  // global.Request = CrossFetchRequest;
  // global.Response = CrossFetchResponse;
  global.fetch = (...args: Parameters<typeof global.fetch>) => {
    const request = normalizeRequest(...args);
    return mockResponse(request).then((resp) => {
      if (request.signal && request.signal.aborted) {
        abort();
      }
      const { body, init } = resp;
      if (body && typeof body === "object") {
        return new Response(body);
      }

      return new Response(body, init);
    });
  };
};

export const mockLambdaContext = ({ requestId = v4(), path = "page" }) => ({
  awsRequestId: requestId,
  callbackWaitsForEmptyEventLoop: true,
  clientContext: undefined,
  functionName: `${path}-post`,
  functionVersion: `$LATEST`,
  identity: undefined,
  invokedFunctionArn: `offline_invokedFunctionArn_for_page-post`,
  logGroupName: `offline_logGroupName_for_page-post`,
  logStreamName: `offline_logStreamName_for_page-post`,
  memoryLimitInMB: String(128),
  getRemainingTimeInMillis: () => {
    return 1000;
  },
  // these three are deprecated
  done: () => ({}),
  fail: () => ({}),
  succeed: () => ({}),
});

const jsonToQs = (obj: Record<string, unknown>) => {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    params.append(k, String(v));
  });
  return params.toString();
};

export const createMockLambdaStep =
  <T extends Record<string, unknown>>({
    path,
    getStep,
    handler,
    contentType = "application/json",
  }: {
    path: string;
    getStep: (t: T) => string;
    handler: APIGatewayProxyHandler;
    contentType?: string;
  }) =>
  async (body: T, requestId = v4()) => {
    return test.step(`Mock Lambda: ${getStep(body)}`, async () => {
      const serializedBody =
        contentType === "application/x-www-form-urlencoded"
          ? jsonToQs(body)
          : JSON.stringify(body);
      const res = handler(
        {
          headers: {
            "Content-Type": contentType,
          },
          multiValueHeaders: {},
          httpMethod: "POST",
          body: serializedBody,
          path,
          isBase64Encoded: false,
          pathParameters: {},
          queryStringParameters: {},
          multiValueQueryStringParameters: {},
          stageVariables: {},
          resource: "",
          requestContext: {
            apiId: "",
            accountId: "",
            authorizer: {},
            protocol: "",
            httpMethod: "POST",
            stage: "test",
            requestId,
            path,
            resourceId: "",
            requestTimeEpoch: new Date().valueOf(),
            resourcePath: "",
            identity: {
              accessKey: null,
              accountId: null,
              apiKey: null,
              apiKeyId: null,
              caller: null,
              clientCert: null,
              cognitoAuthenticationProvider: null,
              cognitoAuthenticationType: null,
              cognitoIdentityId: null,
              cognitoIdentityPoolId: null,
              principalOrgId: null,
              sourceIp: "",
              user: null,
              userAgent: null,
              userArn: null,
            },
          },
        },
        mockLambdaContext({ requestId, path }),
        Promise.resolve
      );
      return res
        ? res.then((r) => {
            try {
              if (r.statusCode < 300) {
                try {
                  return JSON.parse(r.body);
                } catch {
                  return r.body;
                }
              } else {
                return Promise.reject(r.body);
              }
            } catch (e) {
              throw new Error(`Failed to handle response: ${r.body}`);
            }
          })
        : {};
    });
  };
