const toDoubleDigit = (n: number) => n.toString().padStart(2, "0");

const toVersion = (today = new Date()): string =>
  `${today.getFullYear()}-${toDoubleDigit(
    today.getMonth() + 1
  )}-${toDoubleDigit(today.getDate())}-${toDoubleDigit(
    today.getHours()
  )}-${toDoubleDigit(today.getMinutes())}`;

export default toVersion;
