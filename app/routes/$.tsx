import { redirect, type ActionArgs } from "@remix-run/node";

export const loader = () => redirect("/", 301);
export const action = ({ request }: ActionArgs) =>
  redirect(
    "/",
    request.method === "GET" || request.method === "HEAD" ? 301 : 303
  );
