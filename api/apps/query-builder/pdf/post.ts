import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { createZip } from "./Pdf";

type Params = {
  files: [
    {
      title: string;
      content: string;
    }
  ];
};

export const logic = async ({ files }: Params) => {
  try {
    const zip = await createZip(files);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipString = zipBuffer.toString("base64");
    if (!zipString) throw new Error("Failed to create zip");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/zip",
      },
      body: zipString,
      isBase64Encoded: true,
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify(e),
    };
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/.*/],
});
