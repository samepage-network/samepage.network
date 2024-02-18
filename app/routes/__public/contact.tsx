import React from "react";
import getMeta from "~/components/getMeta";
import Title from "~/components/Title";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

type ICal = {
  (cmd: string, options: unknown): void;
  loaded?: boolean;
  ns?: Record<string, unknown>;
  q?: unknown[];
};
declare global {
  interface Window {
    Cal: ICal;
  }
}

const ContactPage: React.FunctionComponent = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (containerRef.current) {
      const p = function (a: ICal, ...ar: unknown[]) {
        a.q?.push(ar);
      };
      const d = window.document;
      window.Cal =
        window.Cal ||
        function (cmd: string, options: unknown) {
          const cal = window.Cal;
          const ar = [cmd, options] as const;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            d.head.appendChild(d.createElement("script")).src =
              "https://app.cal.com/embed/embed.js";
            cal.loaded = true;
          }
          if (ar[0] === "init") {
            const api: ICal = function (...args: unknown[]) {
              p(api, ...args);
            };
            const namespace = ar[1];
            api.q = api.q || [];
            typeof namespace === "string" && cal.ns
              ? (cal.ns[namespace] = api) && p(api, ar)
              : p(cal, ar);
            return;
          }
          p(cal, ar);
        };
      window.Cal("init", { origin: "https://cal.com" });

      window.Cal("inline", {
        elementOrSelector: containerRef.current,
        calLink: "samepage/discovery",
        layout: "month_view",
      });

      window.Cal("ui", {
        styles: { branding: { brandColor: "#3ba4dc" } },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    }
  }, [containerRef]);
  return (
    <div
      style={{
        maxWidth: "800px",
        width: "100%",
      }}
    >
      <Title>Contact Us</Title>
      <div className="overflow-scroll w-full h-full" ref={containerRef} />
    </div>
  );
};

export const meta = getMeta({ title: "Contact Us" });

export default ContactPage;
