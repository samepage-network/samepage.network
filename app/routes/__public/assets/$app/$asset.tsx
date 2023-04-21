import { LoaderFunction } from "@remix-run/node";
import fs from "fs";
import mimeTypes from "mime-types";

export const loader: LoaderFunction = ({ params }) => {
  const { app, asset = "" } = params;
  const buffer = fs.readFileSync(`../${app}-samepage/assets/${asset}`);
  const mimeType = mimeTypes.lookup(asset);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
    },
  });
};
