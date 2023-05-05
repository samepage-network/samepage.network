import React from "react";
import mixClasses from "./mixClasses";
import useLoading from "./useLoading";

export type InputProps = {
  label?: React.ReactNode;
  inputClassname?: string;
  labelClassname?: string;
} & React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

const BaseInput = ({
  label,
  name,
  disabled,
  type,
  className,
  inputClassname,
  labelClassname,
  ...inputProps
}: InputProps) => {
  const loading = useLoading();
  return (
    <div className={mixClasses(`mb-6`, className)}>
      {label && (
        <label
          htmlFor={name}
          className={mixClasses(
            `block mb-2 text-sm font-medium text-gray-900`,
            labelClassname
          )}
        >
          {label}
        </label>
      )}
      <input
        name={name}
        className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5 disabled:opacity-25 disabled:cursor-not-allowed${
          inputClassname ? ` ${inputClassname}` : ""
        }`}
        required
        disabled={typeof disabled === "undefined" ? loading : disabled}
        type={type}
        {...inputProps}
      />
    </div>
  );
};

export default BaseInput;
