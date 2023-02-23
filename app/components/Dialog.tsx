import { Transition, Dialog as HeadlessDialog } from "@headlessui/react";
import React, { useEffect } from "react";
import { useActionData } from "@remix-run/react";

const Dialog = ({
  isOpen,
  onClose,
  title,
  children,
  className = "fixed inset-0 z-30 overflow-y-auto",
  contentClassName = "inline-block w-96 max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl",
  titleClassName = "text-lg font-medium leading-6 text-gray-900",
}: React.PropsWithChildren<{
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
}>) => {
  const actionData = useActionData();
  useEffect(() => {
    if (actionData?.success) {
      onClose();
    }
  }, [actionData]);
  return (
    <Transition show={isOpen} appear>
      <HeadlessDialog
        open={isOpen}
        onClose={onClose}
        as={"div"}
        className={className}
      >
        <div className="min-h-screen px-4 text-center flex justify-center items-center">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <HeadlessDialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-50" />
          </Transition.Child>
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className={contentClassName}>
              <HeadlessDialog.Title as="h3" className={titleClassName}>
                {title}
              </HeadlessDialog.Title>
              {children}
            </div>
          </Transition.Child>
        </div>
      </HeadlessDialog>
    </Transition>
  );
};

export default Dialog;
