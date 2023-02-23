import React from "react";
import BaseInput, { InputProps } from "./BaseInput";

const NumberInput = (inputProps: InputProps) => {
  return <BaseInput type={"number"} {...inputProps} />;
};

export default NumberInput;
