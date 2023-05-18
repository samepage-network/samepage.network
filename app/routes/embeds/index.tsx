import { useNavigate } from "@remix-run/react";
import React, { useEffect, useState } from "react";
import HomeDashboardTab, {
  makeAction,
  makeLoader,
} from "samepage/components/HomeDashboardTab";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import authenticateUser from "~/data/authenticateUser.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const EmbedsIndexPage: React.FC = () => {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof document !== "undefined") {
      setOrigin(document.location?.ancestorOrigins?.[0] || "");
    }
  }, [setOrigin]);
  return <HomeDashboardTab onLogOut={() => navigate("/embeds")} url={origin} />;
};

export const loader = makeLoader({ authenticateNotebook });

export const action = makeAction({ authenticateUser });

export default EmbedsIndexPage;
