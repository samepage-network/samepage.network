import { Link, useSearchParams } from "react-router-dom";

const LinkWithSearch = (props: Parameters<typeof Link>[0]) => {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  return <Link {...props} to={`${props.to}${search ? `?${search}` : ""}`} />;
};

export default LinkWithSearch;
