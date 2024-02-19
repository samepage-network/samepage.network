import { useSearchParams } from "@remix-run/react";
import { useEffect } from "react";

const useClearRefreshParam = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.has("refresh")) {
      searchParams.delete("refresh");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);
};

export default useClearRefreshParam;
