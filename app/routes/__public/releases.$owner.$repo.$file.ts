import { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = ({ params }) => {
  const { owner = "", repo = "", file = "" } = params;
  // remove this exception once all extensions are on samepage >= 0.65.0
  if (/\.md$/.test(file))
    return fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/${file}`
    );
  return fetch(
    `https://github.com/${owner}/${repo}/releases/latest/download/${file}`
  );
};
