import React from "react";
import {
  Form,
//   LoaderFunctionArgs,
  useLoaderData,
//   redirect,
} from "react-router-dom";
import Select from "./Select";
import AtJsonRendered from "./AtJsonRendered";
import Button from "./Button";
import { SamePageSchema } from "../internal/types";

const WorkflowTab: React.FC = () => {
  const data = useLoaderData() as {
    title: SamePageSchema;
    destinations: { notebookUuid: string; app: string; workspace: string }[];
  };
  return (
    <Form method={"post"}>
      <h1 className="text-3xl font-bold mb-8">
        <AtJsonRendered {...data.title} />{" "}
        <img
          src={"https://samepage.network/images/logo.png"}
          className={"inline h-12 w-12"}
        />
      </h1>
      <Select
        label="Destination"
        options={data.destinations.map((d) => ({
          id: d.notebookUuid,
          label: `${d.app} ${d.workspace}`,
        }))}
      />
      <Button>Trigger</Button>
    </Form>
  );
};

export default WorkflowTab;
