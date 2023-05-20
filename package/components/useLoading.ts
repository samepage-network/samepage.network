import { useFetchers, useNavigation } from "react-router-dom";
import { useMemo } from "react";

const useLoading = () => {
  const transition = useNavigation();
  const fetchers = useFetchers();
  const loading = useMemo(
    () =>
      transition.state !== "idle" || fetchers.some((f) => f.state !== "idle"),
    [transition, fetchers]
  );
  return loading;
};

export default useLoading;
