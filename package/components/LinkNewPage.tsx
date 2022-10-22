import React from "react";
import type { OverlayProps } from "../internal/types";
import { Button, Classes, Dialog, InputGroup, Label } from "@blueprintjs/core";
import { v4 } from "uuid";
import { appRoot } from "../internal/registry";

const LinkNewPage = ({
  onClose,
  isOpen,
  notebookPageId,
  linkNewPage = () => Promise.resolve(v4()),
}: OverlayProps<{
  notebookPageId: string;
  linkNewPage?: (notebookPageId: string, title: string) => Promise<string>;
}>) => {
  const [name, setName] = React.useState("");
  return (
    <Dialog
      onClose={onClose}
      isOpen={isOpen}
      title={"Shared Pages"}
      autoFocus={false}
      enforceFocus={false}
      portalContainer={appRoot}
    >
      <div className={Classes.DIALOG_BODY}>
        <p>Migrate linked page from {notebookPageId} to:</p>
        <Label>
          Title
          <InputGroup
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={"Enter page name..."}
          />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose} text={"Cancel"} />
          <Button
            onClick={() => {
              linkNewPage(notebookPageId, name);
            }}
            text={"Submit"}
            intent={"primary"}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default LinkNewPage;
