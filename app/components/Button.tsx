import React from "react";
import useLoading from "./useLoading";

const Button = ({
  children,
  disabled,
  className,
  ...buttonProps
}: React.DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>) => {
  const loading = useLoading();
  return (
    <button
      type="submit"
      className={`px-6 py-3 font-semibold rounded-full bg-accent shadow-sm hover:bg-sky-700 active:bg-sky-900 hover:shadow-md active:shadow-none disabled:cursor-not-allowed disabled:bg-opacity-50 disabled:opacity-50 disabled:hover:bg-sky-500 disabled:hover:shadow-none disabled:active:bg-sky-500 disabled:hover:bg-opacity-50${
        className ? ` ${className}` : ""
      }`}
      disabled={typeof disabled === "undefined" ? loading : disabled}
      {...buttonProps}
    >
      {children}
    </button>
  );
};

export default Button;
