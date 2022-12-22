import React from "react";
import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import type { OverlayProps } from "../internal/types";
import { appRoot } from "../internal/registry";
import * as webnative from "webnative";
import dispatchAppEvent from "package/internal/dispatchAppEvent";

const CreateUsername = ({ onClose, isOpen }: OverlayProps<{}>) => {
  const [username, setUsername] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  return (
    <Dialog
      onClose={onClose}
      isOpen={isOpen}
      title={"Create Username"}
      autoFocus={false}
      enforceFocus={false}
      portalContainer={appRoot}
    >
      <div className={`${Classes.DIALOG_BODY}`}>
        <p className="italic opacity-50">
          Creating a username allows users to share files on SamePage privately
          using end-to-end encryption
        </p>
        <Label>
          Username
          <InputGroup
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={"Enter username..."}
          />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <span className="text-red-900">{error}</span>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          {loading && <Spinner size={SpinnerSize.SMALL} className={"mr-2"} />}
          <Button
            text={"Create"}
            disabled={loading}
            intent={Intent.PRIMARY}
            onClick={async () => {
              setLoading(true);
              const isValid = await webnative.account.isUsernameValid(username);
              if (!isValid) {
                setError("Username contains some invalid characters");
                setLoading(false);
                return;
              }
              const isAvailable = await webnative.account.isUsernameAvailable(
                username
              );
              if (!isAvailable) {
                setError(
                  "Username has already been claimed and is not available. If this is your username, try `Connecting Username` instead."
                );
                setLoading(false);
                return;
              }
              const { success } = await webnative.account.register({
                username,
              });
              if (!success) {
                setError("Registration failed. Please try again later.");
                setLoading(false);
                return;
              }
              const fs = await webnative.bootstrapRootFileSystem();
              // @ts-ignore
              window.wnfs = fs;
              await fs.mkdir(webnative.path.directory("public", "samepage"));
              await fs.mkdir(webnative.path.directory("private", "samepage"));
              dispatchAppEvent({
                type: "log",
                id: "username-success",
                content: "Successfully created SamePage username!",
                intent: "success",
              });
              onClose();
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default CreateUsername;
