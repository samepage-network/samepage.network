import React, { useCallback, useEffect, useRef } from "react";
// import SuccessIcon from "~/assets/Success.svg";
// import WarningIcon from "~/assets/Warning.svg";
// import ErrorIcon from "~/assets/Error.svg";

// const Icons = {
//   success: SuccessIcon,
//   warning: WarningIcon,
//   error: ErrorIcon,
// };

type ToastIntent = "success" | "warning" | "error";
type VERTICAL_POSITION = "BOTTOM" | "TOP";
type HORIZONTAL_POSITION = "LEFT" | "RIGHT";

// original inspiration: https://github.com/mui-org/material-ui/blob/bf78a4a212cb328c951a9f3590a9518c72168f5c/packages/mui-material/src/Snackbar/Snackbar.js
const Toast = ({
  actions = [],
  autoHideDuration = 5000,
  intent = "success",
  isOpen,
  message,
  onClose,
  position = "BOTTOM",
  showCloseIcon = false,
  title,
}: {
  actions?: { text: string; onClick: () => void }[];
  autoHideDuration?: number | null;
  intent?: ToastIntent;
  isOpen: boolean;
  message: React.ReactNode;
  onClose: () => void;
  position?: `${VERTICAL_POSITION}${`_${HORIZONTAL_POSITION}` | ""}`;
  showCloseIcon?: boolean;
  title?: React.ReactNode;
}) => {
  const timerAutoHide = useRef(0);
  const nodeRef = useRef<HTMLDivElement>(null);

  const setAutoHideTimer = useCallback(
    (autoHideDurationParam: number | null) => {
      if (autoHideDurationParam == null) {
        return;
      }

      clearTimeout(timerAutoHide.current);
      timerAutoHide.current = window.setTimeout(onClose, autoHideDurationParam);
    },
    [onClose, timerAutoHide]
  );

  React.useEffect(() => {
    if (isOpen) {
      setAutoHideTimer(autoHideDuration);
    }

    return () => {
      clearTimeout(timerAutoHide.current);
    };
  }, [isOpen, autoHideDuration, setAutoHideTimer]);

  // Pause the timer when the user is interacting with the Toast
  // or when the user hide the window.
  const handlePause = useCallback(() => {
    clearTimeout(timerAutoHide.current);
  }, [timerAutoHide]);

  // Restart the timer when the user is no longer interacting with the Toast
  // or when the window is shown back.
  const handleResume = useCallback(() => {
    if (autoHideDuration != null) {
      setAutoHideTimer(autoHideDuration * 0.5);
    }
  }, [autoHideDuration, setAutoHideTimer]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("focus", handleResume);
      window.addEventListener("blur", handlePause);

      return () => {
        window.removeEventListener("focus", handleResume);
        window.removeEventListener("blur", handlePause);
      };
    }
    return undefined;
  }, [handleResume, isOpen]);

  const handleKeyDown = useCallback(
    (nativeEvent: KeyboardEvent) => {
      if (!nativeEvent.defaultPrevented) {
        if (nativeEvent.key === "Escape" || nativeEvent.key === "Esc") {
          onClose();
        }
      }
    },
    [onClose]
  );

  const handleClickAway = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (!nodeRef.current) {
        return;
      }
      const target = event.target as HTMLElement;
      const insideDOM = event.composedPath
        ? event.composedPath().indexOf(nodeRef.current) > -1
        : document.contains(target) || nodeRef.current.contains(target);

      if (!insideDOM) {
        onClose();
      }
    },
    [nodeRef, onClose]
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClickAway);
    setTimeout(() => {
      if (nodeRef.current) nodeRef.current.style.opacity = "1";
    }, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleClickAway);
    };
  }, [isOpen, handleKeyDown, nodeRef]);

  if (!isOpen) {
    return null;
  }
  // const Icon = Icons[intent];
  const [verticalPosition, horizontalPosition] = position.split("_") as [
    VERTICAL_POSITION,
    HORIZONTAL_POSITION
  ];

  return (
    <div
      onBlur={handleResume}
      onFocus={handlePause}
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      ref={nodeRef}
      className={`z-50 fixed flex left-6 right-6 justify-center items-center transition-opacity duration-700 ${
        verticalPosition === "TOP" ? "top-6" : ""
      }${verticalPosition === "BOTTOM" ? "bottom-6" : ""} ${
        horizontalPosition === "LEFT" ? "justify-left" : ""
      }${horizontalPosition === "RIGHT" ? "justify-right" : ""}`}
      style={{
        opacity: 0,
      }}
    >
      <div
        className={`shadow-md p-3 flex flex-col w-96 rounded-lg tracking-wide ${
          intent === "success" ? "text-white bg-green-600" : ""
        }${intent === "warning" ? "text-gray-900 bg-yellow-400" : ""}${
          intent === "error" ? "text-white bg-red-600" : ""
        }`}
      >
        <div className="flex items-center">
          <div className="mr-3">
            {intent === "success" && (
              <svg
                focusable="false"
                aria-hidden="true"
                viewBox="0 0 24 24"
                width={16}
                height={16}
              >
                <path
                  fill="currentColor"
                  d="M20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4C12.76,4 13.5,4.11 14.2, 4.31L15.77,2.74C14.61,2.26 13.34,2 12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0, 0 22,12M7.91,10.08L6.5,11.5L11,16L21,6L19.59,4.58L11,13.17L7.91,10.08Z"
                />
              </svg>
            )}
            {intent === "warning" && (
              <svg
                focusable="false"
                aria-hidden="true"
                viewBox="0 0 24 24"
                width={16}
                height={16}
              >
                <path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z" />
              </svg>
            )}
            {intent === "error" && (
              <svg
                focusable="false"
                aria-hidden="true"
                viewBox="0 0 24 24"
                width={16}
                height={16}
              >
                <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
              </svg>
            )}
          </div>
          <div className="flex-grow">
            {title && <h1 className="font-bold text-sm mb-1">{title}</h1>}
            <div className="font-semibold text-xs">{message}</div>
          </div>
          {showCloseIcon && (
            <div className="ml-3 cursor-pointer">
              <span onClick={onClose}>X</span>
            </div>
          )}
        </div>
        {!!actions.length && (
          <div className="flex flex-row-reverse">
            {actions.map((a, key) => (
              <button
                key={key}
                onClick={a.onClick}
                className="ml-3 font-semibold text-xs flex items-center bg-transparent border-none hover:cursor-pointer hover:bg-gray-500"
              >
                {a.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Toast;
