import { useNavigate, useSearchParams } from "react-router-dom";

const useNavigateWithSearch = () => {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const navigate = useNavigate();
  return (to: string) => navigate(`${to}${search ? `?${search}` : ""}`);
};

export default useNavigateWithSearch;
