import { LinksFunction } from "@remix-run/node";
import blueprintcss from "@blueprintjs/core/lib/css/blueprint.css";
import blueprinticonscss from "@blueprintjs/icons/lib/css/blueprint-icons.css";
export { default as default, loader } from "package/components/SharedPageTab";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

// TODO - we will one day rid ourselves of blueprint
export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: blueprintcss },
    { rel: "stylesheet", href: blueprinticonscss },
  ];
};
