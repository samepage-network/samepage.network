import React, { useState } from "react";
import { useMemo } from "react";
import { useNavigation } from "react-router-dom";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, SelectorIcon } from "@heroicons/react/solid";

type Option = { id: string | number; label: React.ReactNode };

const Select = ({
  name,
  disabled,
  options: _options = [],
  label,
  className = "",
  labelClassName = "",
  buttonClassName = "",
  optionsClassName = "",
  optionClassName = "",
  onChange,
  defaultValue,
}: {
  name?: string;
  disabled?: boolean;
  options?: readonly Option[] | readonly string[];
  label?: string;
  className?: string;
  labelClassName?: string;
  buttonClassName?: string;
  optionsClassName?: string;
  optionClassName?: string;
  onChange?: (opt: string | number) => void;
  defaultValue?: string | number;
}) => {
  const options = useMemo(
    () =>
      _options.map((id) => (typeof id === "string" ? { id, label: id } : id)),
    [_options]
  );
  const transition = useNavigation();
  const loading = useMemo(() => transition.state !== "idle", [transition]);
  const [selectedOption, setSelectedOption] = useState(() =>
    typeof defaultValue !== "undefined" ? defaultValue : options[0]?.id
  );
  const labelById = useMemo(
    () => Object.fromEntries(options.map((o) => [o.id, o.label])),
    []
  );
  return (
    <div className={`mb-6 ${className}`}>
      <label
        htmlFor={name}
        className={`block mb-2 text-sm font-medium text-gray-900 ${labelClassName}`}
      >
        {label}
      </label>
      <Listbox
        onChange={(e) => {
          setSelectedOption(e);
          setTimeout(() => onChange?.(e), 1);
        }}
        value={selectedOption}
        disabled={typeof disabled === "undefined" ? loading : disabled}
      >
        <input name={name} type={"hidden"} value={selectedOption} />
        <Listbox.Button
          className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full py-2 px-4 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed shadow-md relative text-left ${buttonClassName}`}
        >
          <span className="block truncate">
            {labelById[selectedOption] || (
              <span className="opacity-50">Select an option...</span>
            )}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <SelectorIcon
              className="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </span>
        </Listbox.Button>
        <Transition
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className={"relative z-10"}
        >
          <Listbox.Options
            className={`rounded-md max-h-64 bg-white py-0.5 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none absolute left-0 right-0 overflow-auto scrollbar-thin ${optionsClassName}`}
          >
            {options.map((option) => (
              <Listbox.Option
                key={option.id}
                value={option.id}
                className={({ active }) =>
                  `cursor-pointer relative select-none pl-10 pr-4 py-2 ${
                    active ? "bg-sky-100 text-sky-900" : ""
                  } ${optionClassName}`
                }
              >
                {({ selected }) => (
                  <>
                    <span
                      className={`block truncate ${
                        selected ? "font-medium" : "font-normal"
                      }`}
                    >
                      {" "}
                      {option.label}
                    </span>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sky-800">
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </Listbox>
    </div>
  );
};

export default Select;
