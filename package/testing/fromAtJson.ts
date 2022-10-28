import AtJsonRendered from "../components/AtJsonRendered";
import { InitialSchema, Schema } from "../internal/types";
import React from "react";
import ReactDOMServer from "react-dom/server";

const fromAtJson = (data: InitialSchema | Schema) =>
  ReactDOMServer.renderToString(React.createElement(AtJsonRendered, data));

export default fromAtJson;
