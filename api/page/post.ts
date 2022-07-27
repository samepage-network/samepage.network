import createAPIGatewayProxyHandler from "aws-sdk-plus/dist/createAPIGatewayProxyHandler";
import { ClientId } from "~/enums/clients";
import {
  BadRequestError,
  MethodNotAllowedError,
  ConflictError,
  NotFoundError,
} from "aws-sdk-plus/dist/errors";
import catchError from "~/data/catchError.server";
import getMysql from "@dvargas92495/app/backend/mysql.server";
import { downloadFileContent } from "@dvargas92495/app/backend/downloadFile.server";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import { S3 } from "@aws-sdk/client-s3";
import { v4 } from "uuid";
import postToConnection, {
  removeLocalSocket,
} from "~/data/postToConnection.server";
import endClient from "~/data/endClient.server";
import { HmacSHA512, enc } from "crypto-js";

const s3 = new S3({ region: "us-east-1" });

// @todo - replace with @json
type ViewType = "document" | "bullet" | "numbered";
type TextAlignment = "left" | "center" | "right";
type ActionParams = {
  location?: {
    "parent-uid": string;
    order: number;
  };
  block?: {
    string?: string;
    uid?: string;
    open?: boolean;
    heading?: number;
    "text-align"?: TextAlignment;
    "children-view-type"?: ViewType;
  };
  page?: {
    title?: string;
    uid?: string;
  };
};

type Action = {
  action: "createBlock" | "updateBlock" | "deleteBlock";
  params: ActionParams;
};

const getSharedPage = ({
  instance,
  clientPageId,
  client,
}: {
  instance: string;
  clientPageId: string;
  client: ClientId;
}) =>
  getMysql().then((cxn) =>
    cxn
      .execute(
        `SELECT page_uuid FROM page_instance_links WHERE instance = ? AND client = ? AND client_page_id = ?`,
        [instance, client, clientPageId]
      )
      .then((results) => {
        cxn.destroy();
        const [link] = results as { page_uuid: string }[];
        if (!link)
          throw new NotFoundError(
            `Could not find page from client ${client}, instance ${instance}, and clientPageId ${clientPageId}`
          );
        return link.page_uuid;
      })
  );

const messageInstance = ({
  source,
  target,
  data,
  messageUuid = v4(),
}: {
  source: { instance: string; client: ClientId };
  target: { instance: string; client: ClientId };
  messageUuid?: string;
  data: Record<string, unknown>;
}) => {
  return getMysql().then(async (cxn) => {
    const ids = await cxn
      .execute(
        `SELECT id FROM online_clients WHERE instance = ? AND client = ?`,
        [target.instance, target.client]
      )
      .then((res) => (res as { id: string }[]).map(({ id }) => id));
    const Data = {
      ...data,
      source,
    };
    const online = await Promise.all(
      ids.map((ConnectionId) =>
        postToConnection({
          ConnectionId,
          Data,
        })
          .then(() => true)
          .catch((e) => {
            if (process.env.NODE_ENV === "production") {
              return endClient(ConnectionId, `Missed Message (${e.message})`)
                .then(() => false)
                .catch(() => false);
            } else {
              removeLocalSocket(ConnectionId);
              return false;
            }
          })
      )
    ).then((all) => !!all.length && all.every((i) => i));
    if (!online) {
      await cxn.execute(
        `INSERT INTO messages (uuid, source_instance, source_client, target_instance, target_client, created_date)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          messageUuid,
          source.instance,
          source.client,
          target.instance,
          target.client,
          new Date(),
        ]
      );
      await uploadFile({
        Key: `data/messages/${messageUuid}.json`,
        Body: JSON.stringify(Data),
      });
    }
  });
};

const logic = ({
  method,
  client,
  instance,
  pageUuid,
  clientPageId,
  log,
  networkName,
  password,
}: {
  method: string;
  client: ClientId;
  instance: string;
  pageUuid: string;
  clientPageId: string;
  log: Action[];
  networkName: string;
  password: string;
}): Promise<string | Record<string, unknown>> => {
  switch (method) {
    case "join-shared-page": {
      return downloadFileContent({
        Key: `data/page/${pageUuid}.json`,
      })
        .catch((e) =>
          e.name === "NoSuchKey"
            ? Promise.reject(
                new ConflictError(
                  `No shared page exists under uuid ${pageUuid}`
                )
              )
            : Promise.reject(e)
        )
        .then((r) => {
          return getMysql().then((cxn) => {
            const args = [pageUuid, clientPageId, instance, client];
            return (
              cxn
                .execute(
                  `INSERT INTO page_instance_links (uuid, page_uuid, client_page_id, instance, client)
            VALUES (UUID(), ?, ?, ?, ?)`,
                  args
                )
                // TODO: return body string directly, it's already stringified JSON
                .then(() => r)
                .catch((e) =>
                  Promise.reject(
                    new Error(
                      `Failed to insert link: ${JSON.stringify(
                        args,
                        null,
                        4
                      )}\nReason: ${e.message}`
                    )
                  )
                )
                .finally(() => cxn.destroy())
            );
          });
        })
        .catch(catchError("Failed to join a shared page"));
    }
    case "update-shared-page": {
      if (!log.length) {
        return getSharedPage({ instance, clientPageId, client })
          .then((id) =>
            s3
              .headObject({
                Bucket: "roamjs-data",
                Key: `data/page/${id}.json`,
              })
              .then((r) => ({
                newIndex: Number(r.Metadata?.index) || 0,
              }))
          )
          .catch(catchError("Failed to update a shared page with empty log"));
      }
      return getSharedPage({ instance, clientPageId, client })
        .then((id) => {
          return downloadFileContent({
            Key: `data/page/${id}.json`,
          })
            .then((r) => JSON.parse(r))
            .then((data) => {
              const updatedLog = data.log.concat(log) as Action[];
              const state = data.state;
              log.forEach(({ action, params }) => {
                if (
                  action === "createBlock" &&
                  params.block &&
                  params.location
                ) {
                  const { uid = "", ...block } = params.block;
                  state[params.location["parent-uid"]] = {
                    ...state[params.location["parent-uid"]],
                    children: (
                      state[params.location["parent-uid"]]?.children || []
                    )?.splice(params.location.order, 0, uid),
                  };
                  state[uid] = block;
                } else if (action === "updateBlock" && params.block) {
                  const { uid = "", ...block } = params.block;
                  state[uid] = {
                    ...block,
                    children: state[uid]?.children || [],
                  };
                } else if (action === "deleteBlock" && params.block) {
                  delete state[params.block.uid || ""];
                }
              });
              return uploadFile({
                Key: `data/page/${id}.json`,
                Body: JSON.stringify({ log: updatedLog, state }),
                // Metadata: { index: updatedLog.length.toString() }, TODO
              }).then(() => updatedLog.length);
            })
            .then((newIndex) => {
              return getMysql()
                .then((cxn) =>
                  cxn
                    .execute(
                      `SELECT instance, client FROM page_instance_links WHERE page_uuid = ?`,
                      [id]
                    )
                    .then((r) => {
                      return Promise.all(
                        (r as { client: ClientId; instance: string }[])
                          .filter((item) => {
                            return (
                              item.instance !== instance ||
                              item.client !== client
                            );
                          })
                          .map((target) =>
                            messageInstance({
                              source: { client, instance },
                              target,
                              data: {
                                log,
                                clientPageId,
                                index: newIndex,
                                operation: "SHARE_PAGE_UPDATE",
                              },
                            })
                          )
                      );
                    })
                    .then(() => cxn.destroy())
                )
                .then(() => ({
                  newIndex,
                }));
            });
        })
        .catch(catchError("Failed to update a shared page"));
    }
    // TODO: WE MIGHT DELETE METHODS BELOW HERE
    case "create-network": {
      if (!password) {
        throw new BadRequestError(
          `Must include a password of length greater than zero`
        );
      }
      return getMysql()
        .then(async (cxn) => {
          const existingRooms = await cxn
            .execute(`SELECT n.uuid FROM networks n WHERE n.name = ?`, [
              networkName,
            ])
            .then((res) => res as { uuid: string }[]);
          if (existingRooms.length) {
            throw new BadRequestError(
              `A network already exists by the name of ${name}`
            );
          }
          const salt = v4();
          const now = new Date();
          const uuid = v4();
          await cxn.execute(
            `INSERT INTO networks (id, name, password, created_date, salt)
          VALUES (?,?,?,?,?)`,
            [
              uuid,
              networkName,
              enc.Base64.stringify(
                HmacSHA512(
                  password + salt,
                  process.env.PASSWORD_SECRET_KEY || ""
                )
              ),
              now,
              salt,
            ]
          );
          await cxn.execute(
            `INSERT INTO network_memberships (uuid, network_uuid, instance, client)
          VALUES (?,?,?,?)`,
            [v4(), uuid, instance, client]
          );
          return {
            success: true,
          };
        })
        .catch(catchError("Failed to create network"));
    }
    case "join-network": {
      if (!password) {
        throw new BadRequestError(
          `Must include a password of length greater than zero`
        );
      }
      return getMysql().then(async (cxn) => {
        const [network] = await cxn
          .execute(
            `SELECT n.uuid, n.password, n.salt FROM networks n WHERE n.name = ?`,
            [networkName]
          )
          .then(
            (res) => res as { uuid: string; password: string; salt: string }[]
          );
        if (!network) {
          throw new BadRequestError(
            `There does not exist a network called ${networkName}`
          );
        }
        const [existingMembership] = await cxn
          .execute(
            `SELECT n.uuid FROM network_memberships n 
        WHERE n.networkUuid = ? AND n.instance = ? AND n.client = ?`,
            [network.uuid, instance, client]
          )
          .then((res) => res as { uuid: string }[]);
        if (existingMembership)
          throw new BadRequestError(
            `This graph is already a part of the network ${networkName}`
          );
        const passwordHash = network.password;
        const inputPasswordHash = enc.Base64.stringify(
          HmacSHA512(
            password + (network.salt || ""),
            process.env.PASSWORD_SECRET_KEY || ""
          )
        );
        if (!passwordHash || inputPasswordHash !== passwordHash)
          throw new MethodNotAllowedError(
            `Incorrect password for network ${networkName}`
          );
        const existingMemberships = await cxn
          .execute(
            `SELECT o.id, n.instance, n.client FROM network_memberships n
            INNER JOIN online_clients o ON o.instance = n.instance AND o.client = n.client
        WHERE n.networkUuid = ?`,
            [network.uuid]
          )
          .then(
            (res) => res as { id: string; instance: string; client: ClientId }[]
          );
        await cxn.execute(
          `INSERT INTO network_memberships (uuid, network_uuid, instance, client)
          VALUES (?,?,?,?)`,
          [v4(), network.uuid, instance, client]
        );
        return Promise.all(
          existingMemberships.map(({ id: ConnectionId, ...source }) =>
            postToConnection({
              ConnectionId,
              Data: {
                operation: `INITIALIZE_P2P`,
                to: ConnectionId,
                source,
              },
            })
          )
        )
          .then(() => ({ success: true }))
          .catch(catchError("Failed to join network"));
      });
    }
    case "list-networks": {
      return getMysql().then(async (cxn) => {
        const networks = await cxn
          .execute(
            `SELECT n.name FROM networks n
          INNER JOIN network_memberships nm ON n.uuid = nm.network_uuid 
          WHERE nm.instance = ? AND nm.client = ?`,
            [instance, client]
          )
          .then((res) => (res as { name: string }[]).map((r) => r.name));
        return { networks };
      });
    }
    case "leave-network": {
      return getMysql()
        .then(async (cxn) => {
          await cxn.execute(
            `DELETE nm FROM network_memberships nm 
           INNER JOIN networks n ON n.uuid = nm.network_uuid 
           WHERE n.name = ? AND nm.instance = ? AND nm.client = ?`,
            [networkName, instance, client]
          );
          const others = await cxn
            .execute(
              `SELECT nm.instance, nm.client FROM network_memberships nm
          INNER JOIN networks n ON n.uuid = nm.network_uuid 
          WHERE n.name = ?`,
              [networkName]
            )
            .then((res) => res as { instance: string; client: ClientId }[]);
          if (others.length) {
            await Promise.all([
              others.map((target) =>
                messageInstance({
                  source: { instance, client },
                  target,
                  data: { operation: "LEAVE_NETWORK" },
                })
              ),
            ]);
          } else {
            await cxn.execute(`DELETE FROM networks WHERE name = ?`, [
              networkName,
            ]);
          }
          cxn.destroy();
          return { success: true };
        })
        .catch(catchError("Failed to leave network"));
    }
    // END-TODO
    default:
      throw new NotFoundError(`Unknown method: ${method}`);
  }
};

export const handler = createAPIGatewayProxyHandler(logic);
