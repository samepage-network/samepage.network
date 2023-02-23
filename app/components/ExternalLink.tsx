import type { AnchorHTMLAttributes } from "react";

const ExternalLink = ({
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a
    target="_blank"
    rel="noreferrer"
    className={`text-sky-500 underline hover:no-underline active:text-sky-600 active:no-underline ${className}`}
    {...props}
  />
);

export default ExternalLink;
