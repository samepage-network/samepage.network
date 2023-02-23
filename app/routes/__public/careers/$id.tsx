export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import CAREERS from "~/data/careers.server";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import useMarkdownComponent, {
  MarkdownComponent,
} from "~/components/useMarkdownComponent";
import ExternalLink from "~/components/ExternalLink";

const CareerDescriptionPage = () => {
  const { career } = useLoaderData<{ career: typeof CAREERS[number] }>();
  if (!career) {
    return <div>Posting not found</div>;
  }
  const Component = useMarkdownComponent(career.description);
  return (
    <div>
      <h1 className="font-bold text-2xl my-4">{career.label}</h1>
      <h2 className="font-bold text-xl my-2">Overview</h2>
      <Component />
      <h2 className="font-bold text-xl my-2">Responsibilities</h2>
      <p>
        The following set of responsibilities are based on our current
        understanding on the work needed to be done to grow SamePage. However,
        we're looking for people who enjoy to take ownership of their work and
        begin to form their own thesis on what work would be the highest value
        add for the company. These initial responsibilities include:
        <ul>
          {career.responsibilities.map((r, i) => (
            <li key={i} className="list-disc ml-4">
              <MarkdownComponent>{r}</MarkdownComponent>
            </li>
          ))}
        </ul>
      </p>
      <h2 className="font-bold text-xl my-2">Qualifications</h2>
      <p>
        The following set of qualifications are not individually required, but
        are in the set of qualities we are looking for in candidates. They are
        the criteria by which we will evaluate candidates based on who we end up
        speaking to for the position. These qualifications include:
        <ul>
          {career.qualifications.map((r, i) => (
            <li key={i} className="list-disc ml-4">
              <MarkdownComponent>{r}</MarkdownComponent>
            </li>
          ))}
        </ul>
      </p>
      <p className="mt-16">
        To apply, book a call on{" "}
        <ExternalLink href={"https://cal.com/samepage/meeting"}>
          our calendar
        </ExternalLink>{" "}
        and in the description, list any links to relevant experiences that we
        could review before the call.
      </p>
    </div>
  );
};

// replace with loading from whatever hiring tool we use
export const loader: LoaderFunction = (args) => {
  return {
    career: CAREERS.find((c) => c.id === args.params["id"]),
  };
};

export default CareerDescriptionPage;
