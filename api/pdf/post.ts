import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { createZip } from "../../app/data/Pdf";
// import uploadFileContent from "package/backend/uploadFileContent";

type Params = {
  files: [
    {
      title: string;
      content: string;
    }
  ];
  filename: string;
};

export const logic = async ({ files, filename }: Params) => {
  try {
    const zip = await createZip(files);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipString = zipBuffer.toString("base64");
    if (!zipString) throw new Error("Failed to create zip");

    // const path = `data/pdfs/${filename}.zip`;
    // const uploadResult = await uploadFileContent({
    //   Body: zipBuffer,
    //   Key: path,
    // });
    // if (!uploadResult) throw new Error("Failed to upload zip file");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/zip",
      },
      // body: JSON.stringify(path),
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
