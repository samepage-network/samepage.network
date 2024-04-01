import { z } from "zod";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import getMysql from "~/data/mysql.server";
import { BackendRequest } from "package/internal/types";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import getWebsiteByNotebookProperties from "~/data/getWebsiteByNotebookProperties.server";
import { NotFoundError } from "~/data/errors.server";
import getPrimaryUserEmail from "~/data/getPrimaryUserEmail.server";
import format from "date-fns/format";
import uploadFileContent from "package/backend/uploadFileContent";
import startWebsiteOperation from "~/data/startWebsiteOperation.server";
import { S3 } from "@aws-sdk/client-s3";
import listAllFiles from "~/data/listAllFiles.server";
import { v4 } from "uuid";
import emailError from "package/backend/emailError.server";
import completeWebsiteOperation from "~/data/completeWebsiteOperation.server";

const bodySchema = z.object({ graph: z.string(), operationUuid: z.string() });

const logic = async ({
  authorization,
  requestId,
  graph,
  operationUuid,
}: BackendRequest<typeof bodySchema>) => {
  const cxn = await getMysql(requestId);

  const userId = await authenticateRoamJSToken({
    authorization,
  });

  const requestedWebsite = await getWebsiteByNotebookProperties({
    requestId,
    userId,
    workspace: graph,
    appName: "roam",
  });

  if (!requestedWebsite) {
    const email = await getPrimaryUserEmail(userId);

    if (!email?.endsWith("@samepage.network")) {
      await cxn.end();
      throw new NotFoundError("Website not found.");
    }
  }

  const date = new Date();
  const websiteUuid = requestedWebsite.uuid;
  const newOperationUuid = v4();
  const logStatus = await startWebsiteOperation({
    websiteUuid,
    statusType: "DEPLOY",
    requestId,
    operationUuid: newOperationUuid,
  });
  await logStatus("RESTORING");

  const key = format(date, "yyyyMMddhhmmss");
  const Key = `data/publishing/${websiteUuid}/${key}.json`;
  await uploadFileContent({
    Key,
    Body: JSON.stringify({ type: "restore", operationUuid }),
  });

  // This try/catch would move to a background lambda fcn one day
  try {
    await logStatus("FETCHING SITE CONTENT");
    const s3 = new S3({});

    // const data = await downloadFileContent({
    //   Key: `data/publishing/${websiteUuid}/${key}.json`,
    // });

    // const websiteContent = zPublishingWebsiteContent.safeParse(
    //   JSON.parse(data)
    // );
    // if (!websiteContent.success) {
    //   throw new Error(parseZodError(websiteContent.error));
    // }
    const Bucket = `samepage.network`;
    const SourcePrefix = `data/websites/${websiteUuid}/${operationUuid}`;
    const DestinationPrefix = `data/websites/${websiteUuid}/${newOperationUuid}`;

    const filesToUpload = await listAllFiles({
      Bucket,
      Prefix: SourcePrefix,
    })
      .then((files) => {
        return Array.from(files).map((f) =>
          f.substring(SourcePrefix.length + 1)
        );
      })
      .then((files) => new Set(files));

    if (!filesToUpload.size) {
      await logStatus("FAILURE");
      await cxn.end();
      return { success: false };
    }

    const Prefix = `websites/${websiteUuid}`;
    const keysToDelete = await listAllFiles({
      Bucket,
      Prefix,
    })
      .then((files) => {
        return Array.from(files).filter(
          (f) => !filesToUpload.has(f.substring(Prefix.length + 1))
        );
      })
      .then((files) => new Set(files));

    await logStatus("DELETING STALE FILES");
    if (keysToDelete.size) {
      const DeleteObjects = Array.from(keysToDelete).map((Key) => ({
        Key,
      }));
      for (let i = 0; i < DeleteObjects.length; i += 1000) {
        await s3.deleteObjects({
          Bucket,
          Delete: { Objects: DeleteObjects.slice(i, i + 1000) },
        });
      }
    }

    await logStatus("UPLOADING");
    for (const key of filesToUpload) {
      await s3.copyObject({
        Bucket,
        CopySource: `/${Bucket}/${SourcePrefix}/${key}`,
        Key: `${DestinationPrefix}/${key}`,
      });
      await s3.copyObject({
        Bucket,
        CopySource: `/${Bucket}/${SourcePrefix}/${key}`,
        Key: `${Prefix}/${key}`,
      });
    }

    await logStatus("SUCCESS");
  } catch (err) {
    const e = err as Error;
    console.log(e);
    await logStatus("FAILURE", { message: e.message });
    await emailError("Restore Failed", e);
  } finally {
    await completeWebsiteOperation({
      operationUuid: newOperationUuid,
      requestId,
    });
  }
  await cxn.end();

  return { success: true };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
