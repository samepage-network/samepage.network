import { useState, useMemo } from "react";
import AtJsonRendered from "package/components/AtJsonRendered";
import Textarea from "@dvargas92495/app/components/Textarea";
import { zInitialSchema } from "package/internal/types";

const DEFAULT_VALUE = `{
  "content": "",
  "annotations": []
}`;

const AtJsonRenderedPage = () => {
  const [value, setValue] = useState(DEFAULT_VALUE);
  const data = useMemo(() => {
    try {
      return zInitialSchema.parse(JSON.parse(value));
    } catch {
      return zInitialSchema.parse(JSON.parse(DEFAULT_VALUE));
    }
  }, [value]);
  return (
    <>
      <Textarea
        className="font-mono"
        defaultValue={DEFAULT_VALUE}
        onChange={(e) => setValue(e.target.value)}
      />
      <AtJsonRendered {...data} />
    </>
  );
};

export default AtJsonRenderedPage;
