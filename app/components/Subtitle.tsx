import type { HTMLAttributes } from "react";

const Subtitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={`font-semibold mb-4 text-2xl ${className}`} {...props} />
);

export default Subtitle;
