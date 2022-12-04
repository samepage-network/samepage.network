import { useState } from "react";

const OverlayImg = ({
  src,
  alt,
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      {expanded && (
        <span
          onClick={() => setExpanded(false)}
          className={
            "fixed inset-0 bg-gray-500 bg-opacity-50 z-50 sm:p-32 p-2 flex justify-center items-center"
          }
        >
          <img
            alt={alt}
            src={src}
            className="rounded-md w-full"
            onClick={(e) => e.stopPropagation()}
          />
        </span>
      )}
      <img
        src={src}
        className={`rounded-md cursor-pointer max-h-full w-fit ${className || ""}`}
        onClick={() => setExpanded(true)}
      />
    </>
  );
};

export default OverlayImg;
