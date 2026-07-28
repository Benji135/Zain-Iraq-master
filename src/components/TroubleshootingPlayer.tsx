"use client";

import { useState } from "react";

type FlowOption = {
  text: string;
  next: string;
};

type FlowNode = {
  text: string;
  options?: FlowOption[];
  is_terminal?: boolean;
  outcome?: "resolve" | "escalate";
};

type TroubleshootingFlow = {
  start_node: string;
  nodes: Record<string, FlowNode>;
};

type PlayerProps = {
  flow: any; // Can be JSON or null
};

export default function TroubleshootingPlayer({ flow }: PlayerProps) {
  const parsedFlow = flow as TroubleshootingFlow | null;
  const startNodeId = parsedFlow?.start_node || (parsedFlow?.nodes ? Object.keys(parsedFlow.nodes)[0] : "");
  
  // Track the answer the user picked at each step, not just the node id — the breadcrumb
  // trail is for the person running the diagnostic, and "node_no_service" tells them nothing.
  const [currentNodeId, setCurrentNodeId] = useState<string>(startNodeId);
  const [history, setHistory] = useState<{ nodeId: string; choice: string }[]>([]);

  if (!parsedFlow || !parsedFlow.nodes || !startNodeId || !parsedFlow.nodes[startNodeId]) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center shadow-2xs">
        <p className="text-xs text-zinc-500 font-semibold">No interactive troubleshooting flow configured for this variant.</p>
      </div>
    );
  }

  const currentNode = parsedFlow.nodes[currentNodeId];

  /** An option whose target is absent from the flow definition is a dead end. */
  const isBroken = (nextNodeId: string) => !parsedFlow.nodes[nextNodeId];

  const handleOptionClick = (nextNodeId: string, choice: string) => {
    // Previously this silently did nothing when the target was missing: the button looked
    // enabled, the click produced no response at all, and the user had no way to tell the
    // flow was misconfigured rather than unresponsive. Broken options are now disabled and
    // labelled, so this is a guard rather than the primary defence.
    if (isBroken(nextNodeId)) return;
    setHistory([...history, { nodeId: currentNodeId, choice }]);
    setCurrentNodeId(nextNodeId);
  };

  const handleBack = () => {
    if (history.length > 0) {
      setCurrentNodeId(history[history.length - 1].nodeId);
      setHistory(history.slice(0, -1));
    }
  };

  const handleReset = () => {
    setCurrentNodeId(startNodeId);
    setHistory([]);
  };

  if (!currentNode) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center shadow-2xs">
        <p className="text-xs text-zinc-500 font-semibold">Error: Selected step does not exist in flow definition.</p>
        <button
          onClick={handleReset}
          className="mt-3 rounded bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-zinc-800"
        >
          Reset Flow
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6 text-left">
      {/* Flow Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455 flex items-center gap-1.5">
          <span>🔧</span> Interactive Diagnostics
        </h4>
        <div className="flex gap-2">
          {history.length > 0 && (
            <button
              onClick={handleBack}
              className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-600 transition-all"
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleReset}
            className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-650 transition-all"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Flow Content */}
      <div className="space-y-6">
        <p className="text-sm font-semibold text-zinc-800 leading-relaxed">
          {currentNode.text}
        </p>

        {/* Options / Terminal State */}
        {currentNode.is_terminal ? (
          <div className="pt-2">
            {currentNode.outcome === "resolve" ? (
              <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 text-xs text-green-800 flex items-start gap-2.5">
                <span className="text-base">✔</span>
                <div>
                  <p className="font-bold">Flow Concluded: Resolution Reached</p>
                  <p className="mt-0.5 font-medium text-green-700">Follow the instructions above to resolve the case. No escalation is required.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 text-xs text-red-800 flex items-start gap-2.5">
                <span className="text-base">🚨</span>
                <div>
                  <p className="font-bold">Flow Concluded: Escalate Required</p>
                  <p className="mt-0.5 font-medium text-red-700">Issue requires advanced troubleshooting. Escalate case to Tier 2 engineering queue.</p>
                </div>
              </div>
            )}
            <button
              onClick={handleReset}
              className="mt-4 w-full rounded bg-zinc-950 hover:bg-zinc-800 py-2.5 text-xs font-bold text-white shadow-xs transition-all text-center"
            >
              Run Diagnostics Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {currentNode.options?.map((option, index) => {
              const broken = isBroken(option.next);
              return (
                <button
                  key={index}
                  type="button"
                  disabled={broken}
                  aria-disabled={broken}
                  title={broken ? "This branch has not been built yet" : undefined}
                  onClick={() => handleOptionClick(option.next, option.text)}
                  className={`rounded-lg border p-3.5 text-xs font-bold text-left transition-all shadow-2xs flex items-center justify-between gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
                    broken
                      ? "border-dashed border-zinc-250 bg-zinc-50 text-zinc-400 cursor-not-allowed"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-350 hover:bg-zinc-50 hover:text-zinc-950"
                  }`}
                >
                  <span>{option.text}</span>
                  {broken ? (
                    <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                      Not built
                    </span>
                  ) : (
                    <span className="text-zinc-300 font-normal">→</span>
                  )}
                </button>
              );
            })}

            {currentNode.options?.every((o) => isBroken(o.next)) && (
              <p className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] font-semibold text-amber-800">
                None of the answers at this step lead anywhere yet — the guide is incomplete.
                Escalate this case and let the content team know.
              </p>
            )}
          </div>
        )}
      </div>

      {/* The path taken, as the answers the user chose. This used to print internal node
          ids ("node1 ➔ node_no_service"), which meant nothing to the person running it and
          made it impossible to check the recommended action against the path. */}
      {history.length > 0 && (
        <div className="border-t border-zinc-100 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Your answers</p>
          <ol className="flex flex-wrap items-center gap-1.5">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="rounded border border-zinc-150 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                  {h.choice}
                </span>
                <span aria-hidden="true" className="text-[10px] text-zinc-300">➔</span>
              </li>
            ))}
            <li>
              <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {currentNode.is_terminal ? "Outcome" : "Current step"}
              </span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
