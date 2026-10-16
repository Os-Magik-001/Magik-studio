import { Matrix } from "@/components/matrix";

// The living ground behind the app's glass: a slow gold matrix field and
// drifting amber light. Glass needs something to bend; pure black shows nothing.
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      <div className="ambient absolute -top-1/3 -left-1/4 h-[80vh] w-[80vw] rounded-full bg-[radial-gradient(closest-side,rgba(246,212,58,0.16),transparent)] blur-2xl" />
      <div
        className="ambient absolute -right-1/4 -bottom-1/3 h-[70vh] w-[70vw] rounded-full bg-[radial-gradient(closest-side,rgba(200,140,30,0.14),transparent)] blur-2xl"
        style={{ animationDelay: "-19s" }}
      />
      <div className="absolute inset-0 opacity-25">
        <Matrix variant="field" />
      </div>
      {/* Keep the content area calm: the field shows most at the edges. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_75%_at_60%_45%,rgba(0,0,0,0.88),rgba(0,0,0,0.55)_60%,rgba(0,0,0,0.15)_100%)]" />
    </div>
  );
}
