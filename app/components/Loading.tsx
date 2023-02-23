const Loading = ({
  size = 4,
  thickness = 4,
}: {
  size?: string | number;
  thickness?: number;
}) => {
  return (
    <div className="relative">
      <span
        role="progressbar"
        aria-valuenow={100}
        className={`w-${size} h-${size} -rotate-90 inline-block transition-transform text-gray-100`}
      >
        <svg viewBox="22 22 44 44">
          <circle
            cx={44}
            cy={44}
            r="20.5"
            fill="none"
            strokeWidth={thickness}
            style={{
              strokeDasharray: "128.805",
              strokeDashoffset: 0,
              stroke: "currentcolor",
              transition:
                "stroke-dashoffset 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            }}
          />
        </svg>
      </span>
      <span
        className={`w-${size} h-${size} -rotate-90 inline-block transition-transform text-sky-400 absolute left-0`}
      >
        <svg viewBox="22 22 44 44" className="animate-spin">
          <circle
            cx="44"
            cy="44"
            r="20.5"
            fill="none"
            strokeWidth={thickness}
            style={{
              stroke: "currentcolor",
              strokeDasharray: "80px, 200px",
              strokeDashoffset: 0,
            }}
          ></circle>
        </svg>
      </span>
    </div>
  );
};

export default Loading;
