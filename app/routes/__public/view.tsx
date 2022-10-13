import Button from "@dvargas92495/app/components/Button";
import TextInput from "@dvargas92495/app/components/TextInput";
import { Link, Outlet } from "@remix-run/react";
import { useState } from "react";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const ViewPage = () => {
  // https://bafkreielmmjvxijw37qb4w76j5dqccex5x7gceedmddq4tu7xgrbuahohq.ipfs.w3s.link
  const [cid, setCid] = useState("");
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-8 w-full">
        <TextInput
          onChange={(e) => setCid(e.target.value)}
          label={"CID"}
          className={"flex-grow"}
          placeholder={"Enter cid..."}
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
