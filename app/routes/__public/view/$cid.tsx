import AtJsonRendered from "package/components/AtJsonRendered";
import type { DataFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import downloadIpfsFile from "~/data/downloadIpfsFile.server";
import Automerge from "automerge";
import { Schema, Memo } from "package/internal/types";
import Button from "package/components/Button";
import binaryToBase64 from "package/internal/binaryToBase64";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import base64ToBinary from "package/internal/base64ToBinary";
import { decode } from "@ipld/dag-cbor";
import unwrapSchema from "package/utils/unwrapSchema";
import parseRemixContext from "~/data/parseRemixContext.server";
import getActorInfo from "~/data/getActorInfo.server";
import getMysql from "~/data/mysql.server";

const ViewCidPage = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return (
    <div className="flex flex-col gap-2 h-full justify-between">
      <div className="flex-grow border border-opacity-50 border-gray-300 flex justify-between gap-1">
        <div>
          <AtJsonRendered
            content={data.content}
            annotations={data.annotations}
          />
        </div>
        <div className="flex flex-col-reverse">
          {data.history.map((l, index) => (
            <div
              key={index}
              className={"border-t border-t-gray-800 p-4 relative"}
            >
              <div className={"text-sm absolute top-2 right-2"}>{index}</div>
              <div>
                <span className={"font-bold"}>Action: </span>
                <span>{l.change.message}</span>
              </div>
              <div>
                <span className={"font-bold"}>Actor: </span>
                <span>{data.actorMap[l.change.actor]}</span>
              </div>
              <div>
                <span className={"font-bold"}>Date: </span>
                <span>{new Date(l.change.time * 1000).toLocaleString()}</span>
              </div>
              <div>
                <span className={"font-bold"}>Hash: </span>
                <span>
                  {l.change.hash?.slice(0, 8)}...{l.change.hash?.slice(-4)}
                </span>
              </div>
              <div>
                <span className={"font-bold"}>Deps: </span>
                <span>
                  {l.change.deps.map((d) => (
                    <span className="mr-4">
                      {d.slice(0, 8)}...{d.slice(-4)}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {data.parent && (
        <Link className="flex-shrink" to={`/view/${data.parent}`}>
          <Button>Go to parent</Button>
        </Link>
      )}
    </div>
  );
};

export const loader = ({ params, context }: DataFunctionArgs) => {
  const cid = params["cid"];
  if (!cid) {
    return {
      content: "",
      annotations: [],
      parent: null,
      history: [],
      actorMap: {} as Record<string, string>,
      raw: "",
    };
  }
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  return downloadIpfsFile({ cid }).then(async (bytes) => {
    const memo = decode<Memo>(bytes);
    const doc = Automerge.load<Schema>(memo.body);
    const raw = binaryToBase64(memo.body);
    const history = Automerge.getHistory(
      Automerge.load(base64ToBinary(raw) as Automerge.BinaryDocument)
    );
    const actorIds = new Set(history.map((l) => l.change.actor));
    const actorMap = await Promise.all(
      Array.from(actorIds).map((actorId) =>
        getActorInfo({ actorId, requestId }).then(
          (info) => [actorId, `${info.appName} / ${info.workspace}`] as const
        )
      )
    ).then((info) => Object.fromEntries(info));
    await getMysql(requestId).then((c) => c.end());

    return {
      parent: memo.parent?.toString() || null,
      raw,
      history,
      actorMap,
      ...unwrapSchema(doc),
    };
  });
};

export default ViewCidPage;
