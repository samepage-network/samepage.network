import { useState } from "react";
import { Switch as HeadlessSwitch } from "@headlessui/react";
import mixClasses from "../../package/components/mixClasses";

const Switch = ({
  defaultChecked = false,
  onChange,
  label,
  name,
  labelClassname,
  className,
}: {
  defaultChecked?: boolean;
  onChange?: (b: boolean) => void;
  label?: React.ReactNode;
  name?: string;
  labelClassname?: string;
  className?: string;
}) => {
  const [enabled, setEnabled] = useState(defaultChecked);
  return (
    <HeadlessSwitch.Group>
      <div className={mixClasses("mb-6 flex items-center gap-4", className)}>
        <HeadlessSwitch
          checked={enabled}
          onChange={(s: boolean) => {
            setEnabled(s);
            onChange?.(s);
          }}
          className={`${enabled ? "bg-sky-300" : "bg-gray-200"}
          relative inline-flex h-[26px] w-[50px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2  focus-visible:ring-sky-500 focus-visible:ring-opacity-75`}
          name={name}
        >
          <span className="sr-only">Use setting</span>
          <span
            aria-hidden="true"
            className={`${enabled ? `translate-x-6` : "translate-x-0"}
            pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-sky-500 shadow-lg ring-0 transition duration-200 ease-in-out`}
          />
        </HeadlessSwitch>
        <HeadlessSwitch.Label
          htmlFor={name}
          className={mixClasses(
            `block text-md font-medium text-gray-900 cursor-pointer select-none`,
            labelClassname
          )}
        >
          {label}
        </HeadlessSwitch.Label>
      </div>
    </HeadlessSwitch.Group>
  );
};

export default Switch;
