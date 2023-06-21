import downloadFileContent from "./downloadFileContent";

const downloadResponse = (requestUuid: string) => {
  return downloadFileContent({
    Key: `data/responses/${requestUuid}.json`,
  });
};

export default downloadResponse;
