import { Button, Classes, Dialog, InputGroup, Label } from "@blueprintjs/core";
import type { OverlayProps } from "../internal/types";
import React from "react";

type Props = {
  portalContainer?: HTMLElement;
  onSubmit?: (data: { cid: string; title: string }) => Promise<void>;
};

const ImportSharedPage = ({
  onClose,
  isOpen,
  portalContainer,
  onSubmit = () => Promise.resolve(),
}: OverlayProps<Props>) => {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [error, setError] = React.useState("");
  return (
    <Dialog
      onClose={onClose}
      isOpen={isOpen}
      title={"Import Page"}
      autoFocus={false}
      enforceFocus={false}
      portalContainer={portalContainer}
    >
      <div className={Classes.DIALOG_BODY}>
        <form ref={formRef}>
          <Label>
            Page Version Id
            <InputGroup name={"cid"} />
          </Label>
          <Label>
            Notebook Page Title
            <InputGroup name={"title"} />
          </Label>
        </form>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          {error && <span className={`text-red-800`}>{error}</span>}
          <Button
            onClick={() => {
              const el = formRef.current;
              if (el) {
                const formData = new FormData(el);
                onSubmit({
                  cid: formData.get("cid") as string,
                  title: formData.get("title") as string,
                })
                  .then(onClose)
                  .catch((e) => setError(e.message));
              }
            }}
            intent="primary"
            text="Import"
          />
          <Button onClick={onClose} text="Cancel" />
        </div>
      </div>
    </Dialog>
  );
};

export default ImportSharedPage;
