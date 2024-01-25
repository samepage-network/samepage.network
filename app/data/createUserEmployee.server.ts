import { v4 } from "uuid";

// TODO: Implement this function
const createUserEmployee = async (props: {
  requestId: string;
  workspace: string;
  userId: string;
}) => {
  return { employeeUuid: v4(), ...props };
};

export default createUserEmployee;
