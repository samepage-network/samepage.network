import { ActionFunction, LoaderFunction } from "@remix-run/node";

export const action: ActionFunction = ({ request }) => {
  console.log("action??");
  return request.method;
};

export const loader: LoaderFunction = ({ params, request }) => {
  const { owner = "", repo = "", file = "" } = params;
  // remove this exception once all extensions are on samepage >= 0.65.0
  if (/\.md$/.test(file))
    return fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/${file}`,
      {
        method: request.method,
      }
    ).then((r) => {
      r.headers.set("Access-Control-Allow-Origin", "*");
      return r;
    });
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
