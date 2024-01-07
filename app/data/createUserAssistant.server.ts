import { v4 } from "uuid";

// TODO: Implement this function
const createUserAssistant = async (props: {
  requestId: string;
  workspace: string;
  userId: string;
}) => {
  return { assistantUuid: v4(), ...props };
};

export default createUserAssistant;
