import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { LoaderIcon } from "lucide-react";

type AccordionSectionType = {
  title: string;
  children: React.ReactNode;
  hasData: boolean;
  value: string;
  isLoading?: boolean;
  description?: string;
};
export const AccordionSection = ({
  title,
  children,
  hasData,
  value,
  isLoading,
  description,
}: AccordionSectionType) => {
  if (!hasData && !isLoading) return null;
  return (
    <AccordionItem value={value} id={value}>
      <AccordionTrigger className="m-auto flex flex-1 items-center justify-between my-4 text-center transition-all hover:underline [&[data-state=open]>svg]:rotate-180">
        <h2 className="text-2xl uppercase">{title}</h2>
        {hasData && !isLoading && (
          <span className="text-sm px-4 font-light">{description}</span>
        )}
        {isLoading && <LoaderIcon className="animate-spin ml-4" />}
        {/* TODO - make this work */}
        {/* <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /> */}
      </AccordionTrigger>
      {/* <hr className="mb-8" /> */}
      {hasData && <AccordionContent>{children}</AccordionContent>}
    </AccordionItem>
  );
};
