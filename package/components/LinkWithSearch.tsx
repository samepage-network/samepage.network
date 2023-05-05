import React from "react";
import { Link, useSearchParams } from "react-router-dom";

const LinkWithSearch: React.FC<Parameters<typeof Link>[0]> = (props) => {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  return <Link {...props} to={`${props.to}${search ? `?${search}` : ""}`} />;
};

export default LinkWithSearch;
