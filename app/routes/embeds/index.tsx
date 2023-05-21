import { useNavigate } from "@remix-run/react";
import React, { useEffect, useState } from "react";
import HomeDashboardTab, {
  action,
  loader,
} from "samepage/components/HomeDashboardTab";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
export { action, loader };

const EmbedsIndexPage: React.FC = () => {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof document !== "undefined") {
      setOrigin(
        document.location.ancestorOrigins?.[0] || document.location.origin
      );
    }
  }, [setOrigin]);
  return <HomeDashboardTab onLogOut={() => navigate("/embeds")} url={origin} />;
};

export default EmbedsIndexPage;
