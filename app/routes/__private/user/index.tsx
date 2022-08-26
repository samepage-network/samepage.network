export { default as loader } from "@dvargas92495/app/backend/isAdminLoader.server";
import { Link, useLoaderData } from "@remix-run/react";

const UserIndexPage: React.FunctionComponent = () => {
  const { isAdmin } = useLoaderData<{ isAdmin: boolean }>();
  return isAdmin ? <Link to={"/admin"} className={'text-blue-700 underline'}>Admin Dashboard</Link> : <span />;
};

export default UserIndexPage;
