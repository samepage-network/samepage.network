import { useFetchers, useTransition } from "@remix-run/react";
import { useMemo } from "react";

const useLoading = () => {
  const transition = useTransition();
  const fetchers = useFetchers();
  const loading = useMemo(
    () =>
      transition.state !== "idle" || fetchers.some((f) => f.state !== "idle"),
    [transition, fetchers]
  );
  return loading;
};

export default useLoading;
