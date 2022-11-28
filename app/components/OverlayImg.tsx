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
        <div
          onClick={() => setExpanded(false)}
          className={
            "fixed inset-0 bg-gray-500 bg-opacity-50 z-50 p-32 flex justify-center items-center"
          }
        >
          <img
            alt={alt}
            src={src}
            className="rounded-md w-full"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <img
        src={src}
        className={`rounded-md cursor-pointer ${className}`}
        onClick={() => setExpanded(true)}
      />
    </>
  );
};

export default OverlayImg;
