import BaseInput, { InputProps } from "./BaseInput";
import React from "react";

const TextInput: React.FC<Omit<InputProps, "type">> = (inputProps) => {
  return <BaseInput type={"text"} {...inputProps} />;
};

export default TextInput;
