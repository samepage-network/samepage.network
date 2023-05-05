import BaseInput, { InputProps } from "./BaseInput";

const TextInput = (inputProps: Omit<InputProps, "type">) => {
  return <BaseInput type={"text"} {...inputProps} />;
};

export default TextInput;
