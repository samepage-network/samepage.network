import { XCircle, Database } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";

const CommandPalette = ({
  open,
  setOpen,
  actions,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  actions: {
    prepopulateData: () => void;
    clearData: () => void;
  };
}) => {
  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {/* <CommandGroup heading="Suggestions"> */}

          {/* </CommandGroup> */}
          <CommandSeparator />
          <CommandGroup
          //   heading="Settings"
          >
            <CommandItem
              onSelect={() => {
                actions.prepopulateData();
                setOpen(false);
              }}
            >
              <Database className="mr-2 h-4 w-4" />
              <span>Prepopulate Demo</span>
              {/* <CommandShortcut>⌘P</CommandShortcut> */}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                actions.clearData();
                setOpen(false);
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              <span>Clear</span>
              {/* <CommandShortcut>⌘C</CommandShortcut> */}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default CommandPalette;
