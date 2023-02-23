import React from "react";
import { useMemo } from "react";
import { useTransition } from "@remix-run/react";

export type InputProps = {
  label?: React.ReactNode;
  inputClassname?: string;
  labelClassname?: string;
} & Omit<
  React.DetailedHTMLProps<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    HTMLTextAreaElement
  >,
  "required"
>;

const Textarea = ({
  label,
  name,
  disabled,
  rows = 4,
  className,
  inputClassname,
  labelClassname,
  ...inputProps
}: InputProps) => {
  const transition = useTransition();
  const loading = useMemo(
    () => transition.state === "submitting",
    [transition]
  );
  return (
    <div className={`mb-6${className ? ` ${className}` : ""}`}>
      <label
        htmlFor={name}
        className={`block mb-2 text-sm font-medium text-gray-900${
          labelClassname ? ` ${labelClassname}` : ""
        }`}
      >
        {label}
      </label>
      <textarea
        name={name}
        className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5 disabled:opacity-25 disabled:cursor-not-allowed${
          inputClassname ? ` ${inputClassname}` : ""
        }`}
        rows={rows}
        required
        disabled={typeof disabled === "undefined" ? loading : disabled}
        {...inputProps}
      />
    </div>
  );
};

export default Textarea;
