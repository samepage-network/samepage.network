export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import remixAppLoader from "~/data/remixAppLoader.server";
import { LoaderFunction } from "@remix-run/node";
import { useMatches } from "@remix-run/react";
import getUserOffice from "~/data/getUserOffice.server";
import { useState, useEffect } from "react";
import AuthorsGenerator, { Authors } from "~/components/research-agent/Authors";
import {
  RecentWorks,
  RecentWorksGenerator,
} from "~/components/research-agent/RecentWorks";
import { AccordionSection } from "~/components/research-agent/AccordionSection";
import TopicGenerator from "~/components/research-agent/TopicGenerator";
import { TopicResults } from "~/components/research-agent/TopicResults";
import { Accordion } from "~/components/ui/accordion";
import { useToast } from "~/components/ui/use-toast";
import CommandPalette from "~/components/research-agent/CommandPalette";
import { apiPost } from "package/internal/apiClient";

export type Topics = {
  fieldsOfStudy: string[];
  researchSpecializations: string[];
};

const focusOnTopicInput = () => {
  const input = document.querySelector("#topic-input") as HTMLInputElement;
  input && input.select();
};
const runCpToastNotification = (toast: any) => {
  const runToast = localStorage.getItem("cp-toast-run");
  if (runToast === "true") return;
  setTimeout(() => {
    toast({
      title: "Command Palette",
      description: (
        <span>
          Press <code>CMD/Ctrl + K</code> to open the command palette.
        </span>
      ),
      duration: 3000,
    });
  }, 500);
  localStorage.setItem("cp-toast-run", "true");
};
const navigateToSection = (section: string) => {
  setTimeout(() => {
    const element = document.querySelector(`#${section}`);
    element && element.scrollIntoView({ behavior: "smooth" });
  }, 500);
};

const SingleOfficePage = () => {
  const [initialTopic, setInitialTopic] = useState<string>("");
  const [topics, setTopics] = useState<Topics>({
    fieldsOfStudy: [],
    researchSpecializations: [],
  });
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [authors, setAuthors] = useState<Authors>({
    primary: [],
    secondary: [],
    contrary: [],
  });
  const [selectedAuthor, setSelectedAuthor] = useState<string>("");
  const [recentWorks, setRecentWorks] = useState<RecentWorks>({
    publications: [],
  });

  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingAuthors, setLoadingAuthors] = useState(false);
  const [loadingRecentWorks, setLoadingRecentWorks] = useState(false);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    focusOnTopicInput();
    runCpToastNotification(toast);

    // Command Palette
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // TODO
  // set open items on response of each request to open the accordion
  // possible navigate to the section of the page
  // value={openItems} on <Accordion> component
  //

  type Return = {
    statusCode: number;
    headers: {
      "Content-Type": string;
    };
    body: string;
    isBase64Encoded: boolean;
  };
  const handleSubmit = async ({
    input,
    systemMessage,
    schema,
    setStateCallback,
  }: {
    input: string;
    systemMessage: string;
    schema: any;
    setStateCallback: (response: any) => void;
  }) => {
    const response = await apiPost<Return>({
      path: `llm/structured-output`,
      data: {
        input,
        systemMessage,
        schema,
        langchainProject: "SamePage Agent-Search",
      },
    });

    const data = JSON.parse(response.body);
    setStateCallback(data);
  };

  // TODO
  // clear all children states when parent state changes
  //
  const onTopicGeneratorSubmit = async (
    topicInput: string,
    systemMessage: string,
    schema: any
  ) => {
    setLoadingTopics(true);
    setInitialTopic(topicInput);
    await handleSubmit({
      input: topicInput,
      systemMessage,
      schema,
      setStateCallback: (data) => {
        setTopics(data);
      },
    });
    setLoadingTopics(false);
  };

  const onTopicSelect = async (
    input: string,
    systemMessage: string,
    schema: any
  ) => {
    setLoadingAuthors(true);
    setSelectedTopic(input);
    await handleSubmit({
      input,
      systemMessage,
      schema,
      setStateCallback: (data) => {
        setAuthors(data);
      },
    });
    setLoadingAuthors(false);
    navigateToSection("select-author");
  };

  const onAuthorSelect = async (
    author: string,
    systemMessage: string,
    schema: any
  ) => {
    setSelectedAuthor(author);
    setRecentWorks({ publications: [] });
    setLoadingRecentWorks(true);
    await handleSubmit({
      input: author,
      systemMessage,
      schema,
      setStateCallback: (data) => {
        setRecentWorks(data);
      },
    });
    setLoadingRecentWorks(false);
    navigateToSection("recent-works");
  };

  const hasTopics =
    topics.fieldsOfStudy.length > 0 ||
    topics.researchSpecializations.length > 0;
  const hasAuthors =
    authors.primary.length > 0 ||
    authors.secondary.length > 0 ||
    authors.contrary.length > 0;
  const hasRecentWorks = recentWorks.publications.length > 0;

  const prepopulateData = () => {
    setInitialTopic("Physics");
    setTopics({
      fieldsOfStudy: ["Mathematics", "Chemistry", "Biology"],
      researchSpecializations: ["Quantum Physics", "Astrophysics"],
    });
    setSelectedTopic("Physics");
    setAuthors({
      primary: ["Albert Einstein", "Isaac Newton"],
      secondary: ["Marie Curie", "Stephen Hawking"],
      contrary: ["Nikola Tesla", "Galileo Galilei"],
    });
    setSelectedAuthor("Stephen Hawking");
    setRecentWorks({
      publications: [
        {
          title: "Brief Answers to the Big Questions",
          description:
            "Published in 2018, this book by Stephen Hawking addresses complex scientific concepts in a clear and accessible manner, offering insights into topics like the future of humanity and the existence of God.",
        },
        {
          title: "The Grand Design",
          description:
            "Released in 2010, this collaborative work by Stephen Hawking and Leonard Mlodinow explores the nature of the universe, discussing the concept of a multiverse and the role of scientific laws in shaping our reality.",
        },
      ],
    });
  };
  const clearData = () => {
    setInitialTopic("");
    setTopics({ fieldsOfStudy: [], researchSpecializations: [] });
    setSelectedTopic("");
    setAuthors({ primary: [], secondary: [], contrary: [] });
    setSelectedAuthor("");
    setRecentWorks({ publications: [] });

    setTimeout(() => {
      focusOnTopicInput();
    }, 500);
  };
  const commandPaletteActions = {
    prepopulateData,
    clearData,
  };

  return (
    <div className="container">
      <CommandPalette
        open={commandPaletteOpen}
        setOpen={setCommandPaletteOpen}
        actions={commandPaletteActions}
      />
      <Accordion
        type="multiple"
        defaultValue={[
          "generate-topics",
          "select-topic",
          "select-author",
          "recent-works",
        ]}
      >
        <AccordionSection
          title="Generate Topics"
          hasData={true}
          value="generate-topics"
        >
          <TopicGenerator onTopicGeneratorSubmit={onTopicGeneratorSubmit} />
        </AccordionSection>
        <AccordionSection
          title="Topics"
          hasData={hasTopics}
          value="select-topic"
          isLoading={loadingTopics}
          description="Select a Topic to Generate Authors"
        >
          <TopicResults
            initialTopic={initialTopic}
            topics={topics}
            onTopicSelect={onTopicSelect}
            selectedTopic={selectedTopic}
          />
        </AccordionSection>
        <AccordionSection
          title="Authors"
          hasData={hasAuthors}
          value="select-author"
          isLoading={loadingAuthors}
          description="Select an Author to Generate Recent Works"
        >
          <AuthorsGenerator
            authors={authors}
            onAuthorSelect={onAuthorSelect}
            selectedAuthor={selectedAuthor}
          />
        </AccordionSection>
        <AccordionSection
          title="Recent Works"
          hasData={hasRecentWorks}
          value="recent-works"
          isLoading={loadingRecentWorks}
        >
          <RecentWorksGenerator
            recentWorks={recentWorks}
            author={selectedAuthor}
          />
        </AccordionSection>
      </Accordion>
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

export default SingleOfficePage;
