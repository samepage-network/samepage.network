import { useEffect, useMemo, useState } from "react";
import { Fetcher, useActionData } from "@remix-run/react";
import Toast from "~/components/Toast";

const SuccessfulActionToast = ({
  message = "Successfully submitted action!",
  fetcher,
}: {
  message?: string;
  fetcher?: Fetcher;
}) => {
  const data = useActionData();
  const [isOpen, setIsOpen] = useState(false);
  const [errReason, setErrReason] = useState("");
  const triggerSuccess = useMemo(
    () => (fetcher ? fetcher.data?.success : data?.success),
    [data, fetcher]
  );
  const triggerErrorReason = useMemo(() => {
    if (fetcher) {
      if (fetcher.data?.success === false) return fetcher.data.message;
      else return "";
    } else {
      if (data?.success === false) return data.message;
      else return "";
    }
  }, [data, fetcher, message]);
  useEffect(() => {
    if (triggerSuccess) setIsOpen(true);
    else setErrReason(triggerErrorReason);
  }, [triggerSuccess, triggerErrorReason, setErrReason, setIsOpen]);
  return (
    <>
      <Toast
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        message={(fetcher ? fetcher.data?.message : data?.message) || message}
      />
      <Toast
        isOpen={!!errReason}
        onClose={() => setErrReason("")}
        message={errReason}
        intent={"error"}
      />
    </>
  );
};

export default SuccessfulActionToast;
