import { redirect } from "react-router-dom";

const redirectWithSearch = (path: string, request: Request) => {
  return redirect(`${path}?${new URL(request.url).searchParams.toString()}`);
};

export default redirectWithSearch;
