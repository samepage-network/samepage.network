import AtJsonRendered from "../components/AtJsonRendered";
import { InitialSchema } from "../internal/types";
import React from "react";
import ReactDOMServer from "react-dom/server";

const fromAtJson = (data: InitialSchema) =>
  ReactDOMServer.renderToString(React.createElement(AtJsonRendered, data));

export default fromAtJson;
