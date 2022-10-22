import {
  Button,
  Checkbox,
  Classes,
  Dialog,
  Icon,
  InputGroup,
  Label,
  Spinner,
} from "@blueprintjs/core";
import apiClient from "../internal/apiClient";
import { OverlayProps } from "../internal/types";
import React from "react";
import { app, appRoot, workspace } from "../internal/registry";

// Initial reference - https://www.youtube.com/watch?v=83Yrd3ekWKA
// TODO - Help us improve SamePage panel?
// TODO - Tutorial Video/Panel?

const PAGES = ["WELCOME", "SETUP", "CONNECT", "START", "COMPLETE"] as const;
type Page = typeof PAGES[number];

const ConnectNotebookPage = ({
  setPage,
  setNotebookUuid: rootSetNotebookUuid,
  setToken: rootSetToken,
}: {
  setPage: (s: Page) => void;
  setNotebookUuid: (s: string) => void;
  setToken: (s: string) => void;
}) => {
  const [notebookUuid, setNotebookUuid] = React.useState("");
  const [token, setToken] = React.useState("");
  const [termsOfUse, setTermsOfUse] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const onConnect = React.useCallback(() => {
    setLoading(true);
    apiClient({
      method: "connect-notebook",
      token,
      notebookUuid,
    })
      .then(() => {
        rootSetToken(token);
        rootSetNotebookUuid(notebookUuid);
        setPage("COMPLETE");
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
      });
  }, [
    setError,
    setLoading,
    setPage,
    setNotebookUuid,
    token,
    notebookUuid,
    rootSetToken,
  ]);
  return (
    <div className={`${Classes.DIALOG_BODY} flex flex-col gap-2 items-center`}>
      {loading && (
        <div className="flex flex-col items-center absolute inset-0 bg-opacity-25 z-50">
          <Spinner size={32} />
        </div>
      )}
      <h1 className="text-lg font-normal">
        Connect a Notebook with a Universal Id and Token
      </h1>
      <Label className={"w-1/2"}>
        Notebook Universal ID
        <InputGroup
          value={notebookUuid}
          onChange={(e) => setNotebookUuid(e.target.value)}
        />
      </Label>
      <Label className={"w-1/2"}>
        Token
        <InputGroup value={token} onChange={(e) => setToken(e.target.value)} />
      </Label>
      <Checkbox
        checked={termsOfUse}
        onChange={(e) => setTermsOfUse((e.target as HTMLInputElement).checked)}
        labelElement={
          <span>
            I have read and agree to the{" "}
            <a
              href="https://samepage.network/terms-of-use"
              target={"_blank"}
              rel={"noopener"}
              className={"text-sky-400"}
            >
              Terms of Use
            </a>
          </span>
        }
      />
      <div className="flex items-center gap-8">
        <Button
          disabled={!termsOfUse || !notebookUuid || !token}
          text={"Connect"}
          intent={"primary"}
          onClick={onConnect}
        />
        <Button
          text={"Back"}
          icon={"arrow-left"}
          onClick={() => setPage("SETUP")}
        />
        <span className="text-red-800">{error}</span>
      </div>
    </div>
  );
};

const CreateNotebookPage = ({
  setPage,
  setNotebookUuid,
  setToken: rootSetToken,
}: {
  setPage: (s: Page) => void;
  setNotebookUuid: (s: string) => void;
  setToken: (s: string) => void;
}) => {
  const [inviteCode, setInviteCode] = React.useState("");
  const [termsOfUse, setTermsOfUse] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const onCreate = React.useCallback(() => {
    setLoading(true);
    apiClient<{ notebookUuid: string; token: string }>({
      method: "create-notebook",
      inviteCode,
      app,
      workspace,
    })
      .then(({ notebookUuid, token }) => {
        rootSetToken(token);
        setNotebookUuid(notebookUuid);
        setPage("COMPLETE");
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
      });
  }, [
    setError,
    setLoading,
    setPage,
    setNotebookUuid,
    inviteCode,
    rootSetToken,
  ]);
  return (
    <div
      className={`${Classes.DIALOG_BODY} flex flex-col gap-2 items-center relative h-full`}
    >
      {loading && (
        <div className="flex flex-col items-center absolute inset-0 bg-opacity-25 z-50">
          <Spinner size={32} />
        </div>
      )}
      <h1 className="text-lg font-normal">
        Create a Notebook by generating a Universal Id
      </h1>
      <Label className={"w-1/2"}>
        Invite Code
        <InputGroup
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
      </Label>
      <Checkbox
        checked={termsOfUse}
        onChange={(e) => setTermsOfUse((e.target as HTMLInputElement).checked)}
        labelElement={
          <span>
            I have read and agree to the{" "}
            <a
              href="https://samepage.network/terms-of-use"
              target={"_blank"}
              rel={"noopener"}
              className={"text-sky-400"}
            >
              Terms of Use
            </a>
          </span>
        }
      />
      <div className="flex items-center gap-8">
        <Button
          disabled={!termsOfUse || !inviteCode || loading}
          text={"Create"}
          intent={"primary"}
          onClick={onCreate}
        />
        <Button
          disabled={loading}
          text={"Back"}
          icon={"arrow-left"}
          onClick={() => setPage("SETUP")}
        />
        <span className="text-red-800">{error}</span>
      </div>
    </div>
  );
};

const CompletePage = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className={`${Classes.DIALOG_BODY} flex flex-col gap-2 items-center`}>
      <h1 className="text-lg font-normal">Congratulations! 🎉</h1>
      <p className="flex-grow">
        Each time you log onto your notebook, you can connect to the SamePage
        network by entering the{" "}
        <code className="font-mono font-normal bg-gray-200 rounded-sm">
          Connect to SamePage Network
        </code>{" "}
        command. Close this model by clicking the button below and give it a
        try!
      </p>
      <Button text={"All Done"} intent={"primary"} onClick={onClose} />
    </div>
  );
};

const Onboarding = ({
  isOpen,
  onClose,
  setNotebookUuid,
  setToken,
}: OverlayProps<{
  setNotebookUuid: (s: string) => void;
  setToken: (s: string) => void;
}>) => {
  const [page, setPage] = React.useState<Page>(PAGES[0]);
  return (
    <Dialog
      title={"Welcome to SamePage"}
      isOpen={isOpen}
      onClose={onClose}
      style={{ width: "100%", maxWidth: 800, height: "100%", maxHeight: 600 }}
      portalClassName={"samepage-onboarding-portal"}
      portalContainer={appRoot}
    >
      <style>{`.samepage-onboarding-portal .bp4-dialog-container,
.samepage-onboarding-portal .bp3-dialog-container {
  height: 100%;
}`}</style>
      {page === "WELCOME" && (
        <div
          className={`${Classes.DIALOG_BODY} flex flex-col gap-2 items-center`}
        >
          <div className="w-40 h-40">
            <img src="https://samepage.network/images/logo.png" />
          </div>
          <h1 className="text-lg font-normal">Welcome to SamePage</h1>
          <div className="mb-4 flex-grow">
            <p>
              Connecting you to SamePage - the intra-tool-for-thought protocol.
            </p>
            <p>We're excited to have you!</p>
          </div>
          <Button
            text={"Get Started"}
            onClick={() => setPage("SETUP")}
            intent={"primary"}
          />
        </div>
      )}
      {page === "SETUP" && (
        <div
          className={`${Classes.DIALOG_BODY} flex flex-col gap-2 items-center`}
        >
          <h1 className="text-lg font-normal">New to SamePage?</h1>
          <div className="flex gap-4 items-center h-full">
            <div className="border-gray-400 rounded-lg border p-8 flex flex-col gap-2 items-center h-full flex-1">
              <Icon icon={"import"} size={32} />
              <p className="font-bold text-lg">
                No, I already have a Notebook Universal Id
              </p>
              <p className="text-gray-700 flex-grow">
                Connect your existing notebook using your Notebook token
              </p>
              <Button
                text={"Connect Notebook"}
                onClick={() => setPage("CONNECT")}
                intent={"primary"}
                className={"mt-4"}
              />
            </div>
            <div className="border-gray-400 rounded-lg border p-8 flex flex-col gap-2 items-center h-full flex-1">
              <Icon icon={"plus"} size={32} />
              <p className="font-bold text-lg">Yes, let's get set up!</p>
              <p className="text-gray-700 flex-grow">
                This will create a new Notebook Universal Id and attach it to
                your notebook
              </p>
              <Button
                text={"Start Notebook"}
                onClick={() => setPage("START")}
                intent={"primary"}
                className={"mt-4"}
              />
            </div>
          </div>
        </div>
      )}
      {page === "CONNECT" && (
        <ConnectNotebookPage
          setPage={setPage}
          setNotebookUuid={setNotebookUuid}
          setToken={setToken}
        />
      )}
      {page === "START" && (
        <CreateNotebookPage
          setPage={setPage}
          setNotebookUuid={setNotebookUuid}
          setToken={setToken}
        />
      )}
      {page === "COMPLETE" && <CompletePage onClose={onClose} />}
    </Dialog>
  );
};

export default Onboarding;
