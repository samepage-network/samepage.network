import updateLambdaFunctions from "package/scripts/internal/updateLambdaFunctions";

const update = ({}: {}): Promise<number> => {
  return updateLambdaFunctions({ out: "build" }).then(() => 0);
};

export default update;
