import { Header3 } from "./H3";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Button } from "../ui/button";

export type Authors = {
  primary: string[];
  secondary: string[];
  contrary: string[];
};

const systemMessage = `Role and Goal:
This GPT identifies and provides a list of the most recent works by a given author, along with a short description of each work. It ensures the suggestions are up-to-date, focusing on publications or contributions made by the author in recent years. 

Constraints:
The GPT responds with a list that includes the title of the work, and a brief description. It limits its responses to the most recent works, generally focusing on the last 5 years.  It response in the required json format.

Guidelines:
The GPT maintains an informative and concise tone, ensuring that the descriptions are brief yet informative, providing enough context to understand the significance of each work.

Clarification:
The GPT should never ask for clarification.

Personalization:
The GPT adopts a scholarly and professional tone, suitable for discussing academic or literary contributions.`;
const zod = z.object({
  publications: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    })
  ),
});
const schema = zodToJsonSchema(zod);

const AuthorsGenerator = ({
  authors,
  onAuthorSelect,
  selectedAuthor,
}: {
  authors: Authors;
  onAuthorSelect: (input: string, systemMessage: string, schema: any) => void;
  selectedAuthor: string;
}) => {
  const renderAuthorButtons = (authorList: string[], category: string) => {
    return authorList.map((author, i) => {
      const key = `${category}-${author}-${i}`;
      return (
        <div className="flex items-center" key={key}>
          {/* Need a good Author/Person API */}
          {/* <HoverCard
            key={key}
          >
            <HoverCardTrigger>
              <InfoCircledIcon height={30} width={30} className="pr-2" />
            </HoverCardTrigger>
            <HoverCardContent className="border p-4 shadow-lg rounded-lg bg-white">
              <div>
                <p className="font-bold">Author Info</p>
                <p>Placeholder biography or details for {author}.</p>
              </div>
            </HoverCardContent>
          </HoverCard> */}
          <Button
            variant={selectedAuthor === author ? "default" : "outline"}
            onClick={() => {
              onAuthorSelect(author, systemMessage, schema);
            }}
          >
            {author}
          </Button>
        </div>
      );
    });
  };

  return (
    <div className="container px-4 md:px-6">
      <div className="flex flex-col items-start sm:flex-col md:flex-row md:justify-evenly gap-10">
        <div>
          <Header3 text="Primary Authors" />
          <div className="grid gap-2">
            {renderAuthorButtons(authors.primary, "primary")}
          </div>
        </div>
        <div>
          <Header3 text="Secondary Authors" />
          <div className="grid gap-2">
            {renderAuthorButtons(authors.secondary, "secondary")}
          </div>
        </div>
        <div>
          <Header3 text="Contrary Authors" />
          <div className="grid gap-2">
            {renderAuthorButtons(authors.contrary, "contrary")}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthorsGenerator;
