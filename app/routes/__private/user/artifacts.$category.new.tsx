import { useState } from "react";
import { Form, useParams } from "@remix-run/react";
import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import remixAppLoader from "~/data/remixAppLoader.server";
import Subtitle from "~/components/Subtitle";
import Textarea from "~/components/Textarea";
import BaseInput from "package/components/BaseInput";
import Button from "package/components/Button";
import remixAppAction from "~/data/remixAppAction.server";
import createArtifact from "~/data/createArtifact.server";
import TextInput from "package/components/TextInput";
import Select from "package/components/Select";
import { artifactCategoryNames, artifactStatuses } from "data/schema";
import { v4 } from "uuid";
// import { artifactStatuses } from "data/schema";

export const loader: LoaderFunction = (args) => {
  const { category } = args.params;
  if (!category) throw new Error("Category is required");

  return remixAppLoader(args, async () => {
    return { category };
  });
};

const NewArtifactPage = () => {
  const { category } = useParams();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  return (
    <div className="space-y-6">
      <Subtitle>Create a new {category} artifact</Subtitle>
      <Card>
        <CardHeader>
          <CardTitle>New Artifact</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            <BaseInput type="hidden" name="category" value={category} />
            <Select
              label="Status"
              name="status"
              // options={artifactStatuses} // ReferenceError: Buffer is not defined
              options={["draft", "live"]}
            />
            <TextInput
              label="Title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1"
            />
            <Textarea
              label="Content"
              name="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1"
              rows={5}
            />
            <Button type="submit">Create Artifact</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

const isValidEnumValue = <T extends readonly string[]>(
  value: string,
  enumValues: T
): value is T[number] => {
  return enumValues.includes(value as T[number]);
};

export const action: ActionFunction = (args) => {
  return remixAppAction(args, async ({ requestId, data, userId }) => {
    const title = data.title?.[0] || "";
    const content = data.content?.[0] || "";
    const status = data.status?.[0] || "draft";
    const category = data.category?.[0] || "";

    if (!isValidEnumValue(status, artifactStatuses))
      throw new Error("Invalid status");
    if (!isValidEnumValue(category, artifactCategoryNames))
      throw new Error("Invalid category");

    await createArtifact({
      requestId,
      uuid: v4(),
      userId,
      title,
      category,
      status,
      data: { content },
      createdDate: new Date(),
    });

    return redirect(`/user/artifacts/${category}`);
  });
};

export const handle = {
  Title: "Create New Artifact",
};

export default NewArtifactPage;
