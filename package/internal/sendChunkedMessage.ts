import { json } from "./types";
import { v4 } from "uuid";

const MESSAGE_LIMIT = 15750; // 16KB minus 250b buffer for metadata
const sendChunkedMessage = ({
  data,
  sender,
}: {
  data: { [k: string]: json };
  sender: (data: { [k: string]: json }) => void;
}) => {
  const fullMessage = JSON.stringify(data);
  const uuid = v4();
  const size =
    typeof Blob !== "undefined"
      ? new Blob([fullMessage]).size
      : Buffer.from(fullMessage).length;
  const total = Math.ceil(size / MESSAGE_LIMIT);
  const chunkSize = Math.ceil(fullMessage.length / total);
  for (let chunk = 0; chunk < total; chunk++) {
    const message = fullMessage.slice(
      chunkSize * chunk,
      chunkSize * (chunk + 1)
    );
    sender({
      message,
      uuid,
      chunk,
      total,
    });
  }
};

export default sendChunkedMessage;
