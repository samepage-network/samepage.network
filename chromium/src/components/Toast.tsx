import {
  Intent,
  ToastProps as BlueprintToastProps,
  Toaster,
  ToasterPosition,
} from "@blueprintjs/core";

type ToastBaseProps = {
  content?: string;
  timeout?: number;
  intent?: Intent;
  onDismiss?: BlueprintToastProps["onDismiss"];
  action?: BlueprintToastProps["action"];
};

type ToastProps = {
  id: string;
  position?: ToasterPosition;
} & ToastBaseProps;

export const render = ({
  position = "top",
  ...props
}: ToastProps): (() => void) => {
  const className = `samepage-toast-${position}`;
  const toasterRoot = document.querySelector(
    `.bp4-toast-container.${className}`
  );
  if (toasterRoot) {
    toasterRoot.dispatchEvent(
      new CustomEvent("samepage-toast", { detail: props })
    );
    return () => toasterRoot.remove();
  } else {
    const toaster = Toaster.create({
      position,
      className,
    });

    const Toast = ({
      content = "RoamJS Notification",
      intent = Intent.PRIMARY,
      timeout = 5000,
      onDismiss,
      action,
    }: ToastBaseProps) => {
      return {
        message: (
          <>
            <style>{`.${className} p { margin-bottom: 0; } .${className} { z-index: 150; }`}</style>
            {/* <Markdown>{content}</Markdown> */}
            <div>{content}</div>
          </>
        ),
        intent,
        timeout,
        onDismiss,
        action,
      };
    };
    toaster.show(Toast(props), props.id);
    setTimeout(() => {
      const toasterRoot = document.querySelector<HTMLDivElement>(
        `.bp4-toast-container.${className}`
      );
      if (toasterRoot)
        toasterRoot.addEventListener("samepage-toast", ((e: CustomEvent) => {
          const {
            detail: { id, ...props },
          } = e;
          toaster.show(Toast(props), id);
        }) as EventListener);
    }, 1);
    return () => toaster.dismiss(props.id);
  }
};

export default render;
