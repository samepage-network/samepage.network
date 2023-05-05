import { Link } from "@remix-run/react";
import mixClasses from "../../package/components/mixClasses";

const ButtonLink = ({
  className,
  ...linkProps
}: Parameters<typeof Link>[0]) => {
  return (
    <Link
      className={mixClasses(
        `px-6 py-3 font-semibold rounded-full bg-accent shadow-sm hover:bg-sky-700 active:bg-sky-900 hover:shadow-md active:shadow-none`,
        className
      )}
      {...linkProps}
    />
  );
};

export default ButtonLink;
