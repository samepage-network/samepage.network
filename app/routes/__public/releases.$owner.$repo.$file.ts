import { LoaderFunction } from "@remix-run/node";

// TODO - inline remix-lambda-adapter and move this logic there.
const illegalHeaders = ["transfer-encoding", "connection"];

export const loader: LoaderFunction = ({ params, request }) => {
  const { owner = "", repo = "", file = "" } = params;
  return fetch(
    `https://github.com/${owner}/${repo}/releases/latest/download/${file}`,
    {
      method: request.method,
    }
  ).then((r) => {
    r.headers.set("Access-Control-Allow-Origin", "*");
    illegalHeaders.forEach((h) => r.headers.delete(h));
    return r;
  });
};
