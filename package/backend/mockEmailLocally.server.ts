import { v4 } from "uuid";
import fs from "fs";

const mockEmailLocally = (Body: { Html: { Data: string } }) => {
  const MessageId = v4();
  fs.writeFileSync(`./public/data/emails/${MessageId}.html`, Body.Html.Data);
  console.log(
    "Email stored",
    `${process.env.ORIGIN}/admin/emails/${MessageId}`
  );
  return MessageId;
};

export default mockEmailLocally;
