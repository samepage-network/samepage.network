import React from "react";
import BaseInput, { InputProps } from "../../package/components/BaseInput";

const NumberInput = (inputProps: InputProps) => {
  return <BaseInput type={"number"} {...inputProps} />;
};

export default NumberInput;
