import React from "react";
import useLoading from "./useLoading";

const Button = ({
  children,
  disabled,
  className,
  intent = "primary",
  ...buttonProps
}: React.DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & { intent?: "primary" | "danger" }) => {
  const loading = useLoading();
  return (
    <button
      type="submit"
      className={`px-6 py-3 font-semibold rounded-full shadow-sm hover:shadow-md active:shadow-none disabled:cursor-not-allowed disabled:bg-opacity-50 disabled:opacity-50 disabled:hover:shadow-none disabled:hover:bg-opacity-50 ${
        intent === "danger"
          ? "bg-red-500 hover:bg-red-700 active:bg-red-900 disabled:hover:bg-red-500 disabled:active:bg-red-500"
          : "bg-accent hover:bg-sky-700 active:bg-sky-900 disabled:hover:bg-accent disabled:active:bg-accent"
      }${className ? ` ${className}` : ""}`}
      disabled={typeof disabled === "undefined" ? loading : disabled}
      {...buttonProps}
    >
      {children}
    </button>
  );
};

export default Button;
