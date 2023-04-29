import { useNavigate, useSearchParams } from "@remix-run/react";

const useNavigateWithSearch = () => {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const navigate = useNavigate();
  return (to: string) => navigate(`${to}${search ? `?${search}` : ""}`);
};

export default useNavigateWithSearch;
