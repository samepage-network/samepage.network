import Button from "@dvargas92495/app/components/Button";
import TextInput from "@dvargas92495/app/components/TextInput";
import { Link, Outlet, useParams } from "@remix-run/react";
import { useState, useEffect } from "react";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const ViewPage = () => {
  // https://bafkreielmmjvxijw37qb4w76j5dqccex5x7gceedmddq4tu7xgrbuahohq.ipfs.w3s.link
  const params = useParams();
  const [cidOrLink, setCidOrLink] = useState(params.cid || "");
  const cid = cidOrLink
    .replace(/^https:\/\//, "")
    .replace(/\.ipfs\.w3s\.link$/, "");
  useEffect(() => {
    setCidOrLink(params.cid || "");
  }, [params.cid]);
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-8 w-full">
        <TextInput
          onChange={(e) => setCidOrLink(e.target.value)}
          label={"CID"}
          className={"flex-grow"}
          placeholder={"Enter cid..."}
          value={cidOrLink}
        />
        <Link
          to={cid.replace(/^https:\/\//, "").replace(/\.ipfs\.w3s\.link$/, "")}
        >
          <Button>Go</Button>
        </Link>
      </div>
      <Outlet />
    </div>
  );
};

export default ViewPage;
