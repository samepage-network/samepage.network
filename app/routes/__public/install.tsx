import APPS, { appsById } from "package/internal/apps";
import type { AppId } from "package/internal/types";
import { useState } from "react";

const userApps = APPS.slice(1);
const INSTRUCTIONS: Record<AppId, React.ReactNode> = {
  0: "",
  1: (
    <div className="flex justify-between items-center flex-1 gap-8">
      <h2 className="font-semibold text-xl">1. Open Roam Depot</h2>
      <h2 className="font-semibold text-xl">2. Search For SamePage</h2>
      <h2 className="font-semibold text-xl">3. Click Install!</h2>
    </div>
  ),
  2: (
    <div className="flex justify-between items-center flex-1 gap-8">
      <h2 className="font-semibold text-xl">1. Open LogSeq</h2>
      <h2 className="font-semibold text-xl">2. Search For SamePage</h2>
      <h2 className="font-semibold text-xl">3. Click Install!</h2>
    </div>
  ),
  3: (
    <div className="flex justify-between items-center flex-1 gap-8">
      <h2 className="font-semibold text-xl">1. Open Obsidian</h2>
      <h2 className="font-semibold text-xl">2. Search For SamePage</h2>
      <h2 className="font-semibold text-xl">3. Click Install!</h2>
    </div>
  ),
};

const InstallPage = () => {
  const [selectedApp, setSelectedApp] = useState(userApps[0].id);
  return (
    <div className="flex flex-col items-center max-w-5xl w-full">
      <div className="rounded-full border-sky-600 border mb-12 inline-flex items-center justify-center">
        {userApps.map(({ id, name }) => {
          const selected = selectedApp === id;
          return (
            <div
              onClick={() => setSelectedApp(id)}
              key={id}
              className={`cursor-pointer py-2 px-4 first:rounded-l-full last:rounded-r-full ${
                selected ? "text-white bg-sky-600" : "text-sky-600 bg-white"
              }`}
            >
              {name}
            </div>
          );
        })}
      </div>
      <h1 className="font-bold text-3xl mb-8">
        Install SamePage in {appsById[selectedApp].name}
      </h1>
      <img src={"/images/logo.png"} width={300} height={300} />
      <div className="rounded-md shadow-xl mb-8 flex flex-col p-10 w-full">
        {INSTRUCTIONS[selectedApp]}
      </div>
    </div>
  );
};

export default InstallPage;
