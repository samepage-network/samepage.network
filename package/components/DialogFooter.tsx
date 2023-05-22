import { Button, Classes, Spinner } from "@blueprintjs/core";
import React from "react";

const DialogFooter = ({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: () => Promise<unknown>;
}) => {
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  return (
    <div className={Classes.DIALOG_FOOTER}>
      <div className={Classes.DIALOG_FOOTER_ACTIONS}>
        {loading && <Spinner size={12} />}
        {error && <span className={`text-red-800`}>{error}</span>}
        <Button
          onClick={(e) => {
            setLoading(true);
            onSubmit()
              .then(onClose)
              .catch((e) => {
                setError(e.message);
                setLoading(false);
              });
            e.stopPropagation();
          }}
          intent="primary"
          text="Submit"
          disabled={loading}
        />
        <Button
          onClick={(e) => {
            onClose();
            e.stopPropagation();
          }}
          text="Cancel"
          disabled={loading}
        />
      </div>
    </div>
  );
};

export default DialogFooter;
