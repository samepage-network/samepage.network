import { redirect } from "@remix-run/node";

export const loader = () => {
  // Redirect any 404s just back to the home page
  return redirect("/");
};
