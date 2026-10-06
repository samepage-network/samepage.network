import { useEffect, useRef } from "react";
import startLatticeFlight from "./renderLatticeFlight";

const LatticeFlight = () => {
  const webgl = useRef<HTMLCanvasElement>(null);
  const fallback = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!webgl.current || !fallback.current) return;
    return startLatticeFlight(webgl.current, fallback.current);
  }, []);
  return (
    <>
      <canvas ref={webgl} className="lattice-flight" aria-hidden="true" />
      <canvas
        ref={fallback}
        className="lattice-flight"
        aria-hidden="true"
        hidden
      />
      <main className="wordmark">
        <h1>samepage</h1>
      </main>
    </>
  );
};
export default LatticeFlight;
