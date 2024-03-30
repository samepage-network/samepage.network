import { Header3 } from "./H3";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Button } from "../ui/button";
import { Topics } from "~/routes/__private/user/offices.$uuid";

const systemMessage = `Role and Goal:
To identifies and suggests the most important authors given a specific topic.
It provides three lists in response: 
- Primary Authors: 1-5 of the most prominent authors in the topic.
- Secondary Authors: 1-5 of the less promintent authors in the topic.
- Contrary Authors: 1-5 of the authors that are more contrarian to the consensus.

Constraints:
The GPT responds only with the lists of authors in JSON format and does not provide additional commentary or explanations.

Guidelines:
The GPT leans towards on academic relevance, but will include just regular authors.

Clarification: The GPT should never ask for clarification.`;
const zod = z.object({
  primary: z.array(z.string()),
  secondary: z.array(z.string()),
  contrary: z.array(z.string()),
});
const schema = zodToJsonSchema(zod);

const toTitleCase = (str: string) => {
  return str.replace(/\b(\w)/g, (char) => char.toUpperCase());
};
export const TopicResults = ({
  initialTopic,
  topics,
  onTopicSelect,
  selectedTopic,
}: {
  initialTopic: string;
  topics: Topics;
  onTopicSelect: (input: string, systemMessage: string, schema: any) => void;
  selectedTopic: string;
}) => {
  return (
    <>
      <div className="flex flex-col items-center">
        <Button
          variant={selectedTopic === initialTopic ? "default" : "outline"}
          onClick={() => onTopicSelect(initialTopic, systemMessage, schema)}
        >
          {toTitleCase(initialTopic)}
        </Button>
      </div>
      <div className="flex flex-col items-start sm:flex-col md:flex-row md:justify-evenly gap-10 mt-10">
        <div>
          <Header3 text="Fields of Study" />
          <div className="grid gap-2">
            {topics.fieldsOfStudy.map((topic, index) => (
              <Button
                key={index}
                variant={selectedTopic === topic ? "default" : "outline"}
                onClick={() => onTopicSelect(topic, systemMessage, schema)}
              >
                {toTitleCase(topic)}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Header3 text="Research Specializations" />
          <div className="grid gap-2">
            {topics.researchSpecializations.map((topic, index) => (
              <Button
                key={index}
                variant={selectedTopic === topic ? "default" : "outline"}
                onClick={() => onTopicSelect(topic, systemMessage, schema)}
              >
                {toTitleCase(topic)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
