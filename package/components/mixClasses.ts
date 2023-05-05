const IMPORTANT = /^important /;

const mixClasses = (defaultValue: string, value = "") => {
  return IMPORTANT.test(value)
    ? value.replace(IMPORTANT, "")
    : value
    ? `${defaultValue} ${value}`
    : defaultValue;
};

export default mixClasses;
