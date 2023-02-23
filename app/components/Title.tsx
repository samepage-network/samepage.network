import type { HTMLAttributes } from "react";

const Title = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h1 className={`font-bold text-3xl my-8 ${className}`} {...props} />
);

export default Title;
