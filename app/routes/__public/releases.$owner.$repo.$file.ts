import { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = ({ params, request }) => {
  const { owner = "", repo = "", file = "" } = params;
  return fetch(
    `https://github.com/${owner}/${repo}/releases/latest/download/${file}`,
    {
      method: request.method,
    }
  ).then((r) => {
    r.headers.set("Access-Control-Allow-Origin", "*");
    return r;
  });
};
