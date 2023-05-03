import React, { useState } from "react";
import { Dialog, Classes, MenuItem } from "@blueprintjs/core";
import { Suggest2 } from "@blueprintjs/select";
import { AddCommand, OverlayProps } from "samepage/internal/types";

const CommandPalette = ({
  isOpen,
  onClose,
  commands,
}: OverlayProps<{
  commands: Parameters<AddCommand>[0][];
}>) => {
  const [query, setQuery] = useState("");
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      portalClassName={"samepage-command-portal"}
    >
      <div
        className={`${Classes.DIALOG_BODY}`}
        onKeyDown={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
      >
        <Suggest2
          className="samepage-command-palette"
          items={commands}
          itemPredicate={(s, c) => new RegExp(s, "i").test(c.label)}
          query={query}
          onQueryChange={(q) => setQuery(q)}
          inputProps={{
            autoFocus: true,
            placeholder: "Search Commands...",
            leftIcon: "search",
          }}
          onItemSelect={(item) => {
            item.callback();
            onClose();
          }}
          itemRenderer={(item, props) => (
            <MenuItem
              intent="primary"
              className="text-xl font-bold"
              key={item.label}
              active={props.modifiers.active}
              text={item.label}
            />
          )}
          itemsEqual={(a, b) => a.label === b.label}
          popoverProps={{
            portalClassName: "samepage-command-menu",
            className: "samepage-command-options",
          }}
          openOnKeyDown
        />
      </div>
    </Dialog>
  );
};

export default CommandPalette;
