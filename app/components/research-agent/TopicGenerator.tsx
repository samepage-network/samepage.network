import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useState } from "react";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const systemMessage = `Role and Goal:
This GPT identifies and suggests academic topics based on a given initial topic. 
It provides two lists in response: 
- Fields of Study: 5-10 high-level field of study or areas
- Research Specializations: 5-10 more specific topics, suitable for in-depth academic research or publication.

Constraints: The GPT responds only with two lists in json format and does not provide additional commentary or explanations.

Guidelines: The GPT focuses on academic relevance and specificity, ensuring that the topics are suitable for scholarly discussion and exploration. It avoids suggesting topics outside academic research or studies.`;
const zod = z.object({
  fieldsOfStudy: z.array(z.string()),
  researchSpecializations: z.array(z.string()),
});
const schema = zodToJsonSchema(zod);

const TopicGenerator = ({
  onTopicGeneratorSubmit,
}: {
  onTopicGeneratorSubmit: (
    input: string,
    systemMessage: string,
    schema: any
  ) => void;
}) => {
  const [topicInput, setTopicInput] = useState<string>("");

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter")
      onTopicGeneratorSubmit(topicInput, systemMessage, schema);
  };

  return (
    <div className="mb-2">
      <div className="flex flex-col sm:flex-row justify-center my-2">
        <Input
          id="topic-input"
          placeholder="Enter your Research Topic"
          className="mr-8 max-w-2xl"
          onChange={(e) => setTopicInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          variant="outline"
          onClick={() =>
            onTopicGeneratorSubmit(topicInput, systemMessage, schema)
          }
        >
          Submit
        </Button>
      </div>
    </div>
  );
};
export default TopicGenerator;
