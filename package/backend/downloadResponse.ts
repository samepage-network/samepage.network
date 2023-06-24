import downloadFileContent from "./downloadFileContent";

const downloadResponse = (messageUuid: string) => {
  return downloadFileContent({
    Key: `data/responses/${messageUuid}.json`,
  });
};

export default downloadResponse;
