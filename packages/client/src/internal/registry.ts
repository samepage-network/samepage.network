import { AddCommand, RemoveCommand } from "../types";

export let addCommand: AddCommand;
export let removeCommand: RemoveCommand;

const setupRegistry = ({
  addCommand: ac,
  removeCommand: rc,
}: {
  addCommand: AddCommand;
  removeCommand: RemoveCommand;
}) => {
  addCommand = ac;
  removeCommand = rc;
};

export default setupRegistry;
