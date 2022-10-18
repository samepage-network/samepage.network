import { useState } from "react";
import Onboarding from "package/components/Onboarding";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import type { LoaderFunction } from "@remix-run/node";

const OnboardingPage = () => {
  const [notebookUuid, setNotebookUuid] = useState("");
  const [token, setToken] = useState("");
  const [isOpen, setIsOpen] = useState(!notebookUuid);
  return (
    <>
      <div>Notebook Universal Id: {notebookUuid}</div>
      <div>Notebook Token: {token}</div>
      <Onboarding
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        setNotebookUuid={setNotebookUuid}
        setToken={setToken}
      />
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, () => {
    return {};
  });
};

export default OnboardingPage;
