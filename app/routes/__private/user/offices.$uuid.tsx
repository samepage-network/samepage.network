export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import remixAppLoader from "~/data/remixAppLoader.server";
import { LinksFunction, LoaderFunction } from "@remix-run/node";
import {
  // useLoaderData,
  useMatches,
} from "@remix-run/react";
import getUserOffice from "~/data/getUserOffice.server";
import { useState } from "react";
import { InputGroup, Button, Card } from "@blueprintjs/core";
import blueprintcss from "@blueprintjs/core/lib/css/blueprint.css";
import blueprinticonscss from "@blueprintjs/icons/lib/css/blueprint-icons.css";
import Toast from "~/components/Toast";

const port = process.env.FLOWISE_PORT || 3050;

const H3: React.FC<{ text: string }> = ({ text }) => {
  return <h3 className="text-xl font-bold tracking-tighter mb-4">{text}</h3>;
};
type ErrorMessageProps = {
  message: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
};
const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, setError }) => {
  if (!message) return null;
  console.error("Error Message:", message);
  return (
    <Toast
      position="TOP_RIGHT"
      intent="warning"
      isOpen={!!message}
      message={"Error parsing result from LLM. Please try again."}
      onClose={() => setError(null)}
    />
  );
};
const fetchFlowiseLlmChain = async (endpoint: string, prompt: string) => {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question: prompt }),
  };
  try {
    const response = await fetch(
      `http://localhost:${port}/api/v1/prediction/${endpoint}`,
      options
    );
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.statusText}`);
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error in fetchData function:", error);
    return {
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
};
const handleSubmit = async (
  endpoint: string,
  prompt: string,
  setStateCallback: (response: any) => void,
  setError: (error: string | null) => void
) => {
  setError(null);
  const response = await fetchFlowiseLlmChain(endpoint, prompt);

  if ("error" in response) {
    setError(response.error);
  } else {
    if (response.json) {
      setStateCallback(response.json);
    } else if (response.text) {
      setStateCallback(response.text);
    }
  }
};

//
// TOPIC GENERATOR
//
type Topics = {
  fieldsOfStudy: string[];
  researchSpecializations: string[];
};
type TopicGenerator = {
  onGenerate: (topicInput: string) => void;
};
const TopicGenerator: React.FC<TopicGenerator> = ({ onGenerate }) => {
  const [topicInput, setTopicInput] = useState<string>("");

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onGenerate(topicInput);
    }
  };

  const searchButton = (
    <Button
      icon="search"
      minimal={true}
      onClick={() => onGenerate(topicInput)}
    />
  );

  return (
    <div className="container grid items-center px-4 text-left md:px-6">
      <div className="text-center">
        <H3 text="Topic Generator" />
      </div>
      <div className="h-12 max-w-xl mx-auto flex">
        <InputGroup
          id="research-topic"
          placeholder="Enter your Research Topic"
          type="text"
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          rightElement={searchButton}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
};

//
// TOPIC RESULTS
//
type TopicResults = {
  topics: Topics;
  onTopicSelect: (topic: string) => void;
};
const TopicResults: React.FC<TopicResults> = ({ topics, onTopicSelect }) => {
  const hasTopics =
    topics.fieldsOfStudy.length > 0 ||
    topics.researchSpecializations.length > 0;
  if (!hasTopics) return null;
  return (
    <div className="flex flex-col items-start sm:flex-col md:flex-row md:justify-evenly gap-10 mt-10">
      <fieldset>
        <H3 text="Fields of Study" />
        <div className="grid gap-2">
          {topics.fieldsOfStudy.map((field, i) => {
            const fieldId = `${field}-${i}`;
            return (
              <div key={fieldId} className="flex gap-2 items-center">
                <Button
                  className="font-normal"
                  text={field}
                  onClick={() => onTopicSelect(field)}
                />
              </div>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <H3 text="Research Specializations" />
        <div className="grid gap-2">
          {topics.researchSpecializations.map((spec, i) => {
            const specId = `${spec}-${i}`;
            return (
              <div key={specId} className="flex gap-2 items-center">
                <Button
                  className="font-normal"
                  text={spec}
                  onClick={() => onTopicSelect(spec)}
                />
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
};

//
// AUTHORS
//
type Authors = {
  primary: string[];
  secondary: string[];
  contrary: string[];
};
type AuthorsGenerator = {
  authors: Authors;
  onAuthorSelect: (author: string) => void;
};
const AuthorsGenerator: React.FC<AuthorsGenerator> = ({
  authors,
  onAuthorSelect,
}) => {
  const renderAuthorButtons = (authorList: string[], category: string) => {
    return authorList.map((author, i) => {
      const key = `${category}-${author}-${i}`;
      return (
        <div key={key} className="flex gap-2 items-center">
          <Button
            className="font-normal"
            text={author}
            onClick={() => onAuthorSelect(author)}
          />
        </div>
      );
    });
  };
  const hasAuthors =
    authors.primary.length > 0 ||
    authors.secondary.length > 0 ||
    authors.contrary.length > 0;
  if (!hasAuthors) return null;
  return (
    <div className="flex flex-col items-start sm:flex-col md:flex-row md:justify-evenly gap-10 mt-10">
      <fieldset>
        <H3 text="Primary Authors" />
        <div className="grid gap-2">
          {renderAuthorButtons(authors.primary, "primary")}
        </div>
      </fieldset>
      <fieldset>
        <H3 text="Secondary Authors" />
        <div className="grid gap-2">
          {renderAuthorButtons(authors.secondary, "secondary")}
        </div>
      </fieldset>
      <fieldset>
        <H3 text="Contrary Authors" />
        <div className="grid gap-2">
          {renderAuthorButtons(authors.contrary, "contrary")}
        </div>
      </fieldset>
    </div>
  );
};

//
// RECENT WORKS
//
type Publication = {
  title: string;
  description: string;
};
type RecentWorks = Publication[];
type RecentWorksGenerator = {
  recentWorks: RecentWorks;
};
const RecentWorksGenerator: React.FC<RecentWorksGenerator> = ({
  recentWorks,
}) => {
  const hasRecentWorks = recentWorks.length > 0;
  if (!hasRecentWorks) return null;
  return (
    <div className="container grid items-center px-4 text-left md:px-6 mt-10">
      <div className="text-center">
        <H3 text="Recent Works" />
      </div>

      <div className="w-full">
        {recentWorks.map((work, i) => {
          return (
            <div key={i} className="flex flex-col gap-2">
              <Card className="mb-4" title={work.title} elevation={2}>
                <h4 className="text-lg font-bold">{work.title}</h4>
                <p className="text-sm">{work.description}</p>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// PAGE
const Office = () => {
  const [topics, setTopics] = useState<Topics>({
    fieldsOfStudy: [],
    researchSpecializations: [],
  });
  const [authors, setAuthors] = useState<Authors>({
    primary: [],
    secondary: [],
    contrary: [],
  });
  const [recentWorks, setRecentWorks] = useState<RecentWorks>([]);
  const [error, setError] = useState<string | null>(null);

  const onSubmitTopic = (topicInput: string) => {
    handleSubmit(
      "44689481-4411-4392-a3da-3dc27becfe29",
      topicInput,
      setTopics,
      setError
    );
  };
  const onTopicSelect = (topic: string) => {
    handleSubmit(
      "6f5aa68f-b956-4573-a20e-5df101f737d3",
      topic,
      setAuthors,
      setError
    );
  };
  const onAuthorSelect = (author: string) => {
    handleSubmit(
      "b36bb26d-5e3e-4eb1-9f39-216fcae6ef47",
      author,
      setRecentWorks,
      setError
    );
  };

  // PPLX
  // const generateRecentWorks = async (
  //   author: string
  // ): Promise<GenerateRecentWorksApiResponse> => {
  //   const systemMessage = `Role and Goal:
  //   This GPT identifies and provides a list of the most recent works by a given author, along with a short description of each work. It ensures the suggestions are up-to-date, focusing on publications or contributions made by the author in recent years.

  //   Constraints:
  //   The GPT responds with a list that includes the title of the work, the year of publication, and a brief description. It limits its responses to the most recent works, generally focusing on the last 5 years.

  //   Guidelines:
  //   The GPT maintains an informative and concise tone, ensuring that the descriptions are brief yet informative, providing enough context to understand the significance of each work.

  //   Clarification:
  //   The GPT should ask for clarification if the author's name is too common or if more context is needed to accurately identify the author's latest works.

  //   Personalization:
  //   The GPT adopts a scholarly and professional tone, suitable for discussing academic or literary contributions.

  //   // BEING EXAMPLE
  //   // EXAMPLE INPUT
  //   Input: Sam Harris

  //   // EXAMPLE RESPONSE
  //   "Making Sense: Conversations on Consciousness, Morality, and the Future of Humanity": This book is a collection of conversations between Sam Harris and various guests, exploring topics such as consciousness, free will, and the ethical implications of emerging technologies.

  // "Free Will": In this thought-provoking book, Harris delves into the debate surrounding free will, arguing that our understanding of the concept is flawed and that we have less control over our actions than we think.

  // "The Moral Landscape": Harris presents a controversial argument that science can and should provide a framework for determining moral values and guiding human behavior. This book sparked lively debates and critiques from both religious and secular communities.

  // "The End of Faith": In his first book, Harris challenges the validity and usefulness of religious beliefs and argues for a rational and scientific approach to moral and ethical issues. It became a New York Times bestseller and established Harris as a prominent voice in the atheist movement.
  //   // END EXAMPLE`;
  //   // const apiKey = process.env.PPLX_API; // Undefined?
  //   const apiKey = "pplx-1001ce7ad6cf085321a00......";
  //   const options = {
  //     method: "POST",
  //     headers: {
  //       accept: "application/json",
  //       "content-type": "application/json",
  //       authorization: `Bearer ${apiKey}`,
  //     },
  //     body: JSON.stringify({
  //       model: "pplx-7b-online",
  //       messages: [
  //         { role: "system", content: systemMessage },
  //         {
  //           role: "user",
  //           content: author,
  //         },
  //       ],
  //     }),
  //   };

  //   try {
  //     const response = await fetch(
  //       "https://api.perplexity.ai/chat/completions",
  //       options
  //     );
  //     const data = await response.json();
  //     return data;
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };

  return (
    <div className="w-full py-12">
      <ErrorMessage message={error} setError={setError} />
      <TopicGenerator onGenerate={onSubmitTopic} />
      <TopicResults topics={topics} onTopicSelect={onTopicSelect} />
      <AuthorsGenerator authors={authors} onAuthorSelect={onAuthorSelect} />
      <RecentWorksGenerator recentWorks={recentWorks} />
    </div>
  );
};

// REMIX STUFF
const SingleOfficePage = () => {
  return (
    <div className="flex gap-4 h-full items-start relative">
      <Office />
    </div>
  );
};
export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, async ({ context, params }) => {
    // TODO: Validate that user has access to office
    return getUserOffice({ context, params });
  });
};
const Title = () => {
  const matches = useMatches();
  const data = matches[3].data as Awaited<ReturnType<typeof getUserOffice>>;
  return data ? <span className="normal-case">{data.name}</span> : "Office";
};
export const handle = { Title };
export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: blueprintcss },
    { rel: "stylesheet", href: blueprinticonscss },
  ];
};
export default SingleOfficePage;
