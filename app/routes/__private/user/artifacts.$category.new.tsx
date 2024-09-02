import { useState } from "react";
import { Form, useParams } from "@remix-run/react";
import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import remixAppLoader from "~/data/remixAppLoader.server";
import Subtitle from "~/components/Subtitle";
import Textarea from "~/components/Textarea";
import BaseInput from "package/components/BaseInput";
import Button from "package/components/Button";

export const loader: LoaderFunction = (args) => {
  const { category } = args.params;
  if (!category) throw new Error("Category is required");

  return remixAppLoader(args, async () => {
    return { category };
  });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const title = formData.get("title");
  const content = formData.get("content");
  const category = formData.get("category");

  // TODO: Implement actual artifact creation logic here
  console.log("Creating new artifact:", { title, content, category });

  // Redirect to the artifacts list page for the given type
  return redirect(`/user/artifacts/${category}`);
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
            <input type="hidden" name="category" value={category} />
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700"
              >
                Title
              </label>
              <BaseInput
                type="text"
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-gray-700"
              >
                Content
              </label>
              <Textarea
                id="content"
                name="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1"
                rows={5}
              />
            </div>
            <Button type="submit">Create Artifact</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export const handle = {
  Title: "Create New Artifact",
};

export default NewArtifactPage;
