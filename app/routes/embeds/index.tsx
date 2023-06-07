import React, { useEffect, useState } from "react";
import HomeDashboardTab, {
  action,
  loader,
} from "samepage/components/HomeDashboardTab";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
export { action, loader };

const EmbedsIndexPage: React.FC = () => {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof document !== "undefined") {
      setOrigin(
        document.location.ancestorOrigins?.[0] || document.location.origin
      );
    }
  }, [setOrigin]);
  return <HomeDashboardTab url={origin} />;
};

export default EmbedsIndexPage;
