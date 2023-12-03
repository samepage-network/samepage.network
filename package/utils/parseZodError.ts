import { ZodError } from "zod";

const parseZodError = (e: ZodError, indentation = 0): string => {
  const err = `${"".padStart(indentation * 2, " ")}${e.issues
    .map((i) =>
      i.code === "invalid_type"
        ? `Expected \`${i.path.join(".") || "[root]"}\` to be of type \`${
            i.expected
          }\` but received type \`${i.received}\``
        : i.code === "invalid_union"
        ? `Path \`${i.path.join(
            "."
          )}\` had the following union errors:\n${i.unionErrors
            .map((e) => parseZodError(e, indentation + 1))
            .join("")}`
        : `${i.message} (${i.code})`
    )
    .map((s) => `- ${s}\n`)
    .join("")}`;
  return indentation === 0 ? err.trim() : err;
};

export default parseZodError;
