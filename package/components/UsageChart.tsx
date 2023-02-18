import React from "react";
import { Classes, Dialog } from "@blueprintjs/core";
import type { Notebook, OverlayProps } from "../internal/types";
import { appsById } from "../internal/apps";

export type UsageChartProps = {
  notebooks: ({ uuid: string; pages: number } & Notebook)[];
  quotas: Record<string, number>;
  portalContainer?: HTMLElement;
};

const UsageChart = ({
  onClose,
  portalContainer,
  isOpen,
  ...stats
}: OverlayProps<UsageChartProps>) => {
  // just doing this to skirt around the React unused import error/umd global catch 22 for now
  React.useEffect(() => {}, []);

  return (
    <Dialog
      onClose={onClose}
      isOpen={isOpen}
      title={"Usage Chart"}
      autoFocus={false}
      enforceFocus={false}
      portalContainer={portalContainer}
    >
      <div className={`${Classes.DIALOG_BODY}`}>
        <div className="grid grid-cols-3 mb-16">
          <div className="font-bold">App</div>
          <div className="font-bold">Workspace</div>
          <div className="font-bold">Pages</div>
          {stats.notebooks.map((notebook) => (
            <React.Fragment key={notebook.uuid}>
              <div className="font-semibold">
                {appsById[notebook.app]?.name || "Unknown"}
              </div>
              <div className="font-normal">{notebook.workspace}</div>
              <div className="font-normal">{notebook.pages}</div>
            </React.Fragment>
          ))}
        </div>
        <div className="text-xs italic">
          Current plan includes max {stats.quotas["Notebooks"]} notebooks/user
          with max {stats.quotas["Pages"]} pages/notebook.
        </div>
      </div>
    </Dialog>
  );
};

export default UsageChart;
