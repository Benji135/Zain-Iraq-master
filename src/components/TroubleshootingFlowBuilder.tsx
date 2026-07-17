"use client";

import { useRef, useState } from "react";
import TroubleshootingPlayer from "@/components/TroubleshootingPlayer";

type Option = { label: string; target: string };
type Step = {
  key: string;
  text: string;
  kind: "question" | "resolve" | "escalate";
  options: Option[];
};

type Props = {
  value: string; // JSON string — same shape the backend/player already expect
  onChange: (value: string) => void;
};

function parseFlowToSteps(json: string): Step[] | null {
  if (!json || !json.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    const nodes = parsed?.nodes;
    if (!nodes || typeof nodes !== "object") return null;
    const keys = Object.keys(nodes);
    if (keys.length === 0) return null;
    const startKey = parsed.start_node && nodes[parsed.start_node] ? parsed.start_node : keys[0];
    const ordered = [startKey, ...keys.filter((k) => k !== startKey)];
    return ordered.map((key) => {
      const node = nodes[key] || {};
      if (Array.isArray(node.options) && node.options.length > 0) {
        return {
          key,
          text: node.text || "",
          kind: "question" as const,
          options: node.options.map((o: any) => ({ label: o.text || "", target: o.next || "" })),
        };
      }
      return {
        key,
        text: node.text || "",
        kind: node.outcome === "escalate" ? ("escalate" as const) : ("resolve" as const),
        options: [],
      };
    });
  } catch {
    return null;
  }
}

function stepsToFlowJson(steps: Step[]): string {
  if (steps.length === 0) return "";
  const nodes: Record<string, any> = {};
  for (const s of steps) {
    if (s.kind === "question") {
      nodes[s.key] = {
        text: s.text,
        options: s.options.filter((o) => o.target).map((o) => ({ text: o.label, next: o.target })),
      };
    } else {
      nodes[s.key] = { text: s.text, is_terminal: true, outcome: s.kind };
    }
  }
  return JSON.stringify({ start_node: steps[0].key, nodes }, null, 2);
}

function stepLabel(step: Step, index: number): string {
  const snippet = step.text.trim().slice(0, 40);
  return `Step ${index + 1}${snippet ? ` — ${snippet}${step.text.trim().length > 40 ? "…" : ""}` : ""}`;
}

export default function TroubleshootingFlowBuilder({ value, onChange }: Props) {
  const [steps, setSteps] = useState<Step[] | null>(() => parseFlowToSteps(value));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const counter = useRef(0);

  const nextKey = () => {
    counter.current += 1;
    return `step_new_${Date.now()}_${counter.current}`;
  };

  const commit = (next: Step[]) => {
    setSteps(next);
    onChange(stepsToFlowJson(next));
  };

  const start = () => {
    commit([
      {
        key: nextKey(),
        text: "",
        kind: "question",
        options: [
          { label: "", target: "" },
          { label: "", target: "" },
        ],
      },
    ]);
  };

  const removeGuide = () => {
    setSteps(null);
    onChange("");
  };

  const updateStep = (key: string, patch: Partial<Step>) => {
    if (!steps) return;
    commit(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    if (!steps) return;
    commit([...steps, { key: nextKey(), text: "", kind: "question", options: [{ label: "", target: "" }, { label: "", target: "" }] }]);
  };

  const removeStep = (key: string) => {
    if (!steps || steps.length <= 1) return;
    const remaining = steps.filter((s) => s.key !== key);
    // Clear any option that pointed at the removed step so we never save a broken reference.
    const cleaned = remaining.map((s) => ({
      ...s,
      options: s.options.map((o) => (o.target === key ? { ...o, target: "" } : o)),
    }));
    commit(cleaned);
  };

  const updateOption = (stepKey: string, optIndex: number, patch: Partial<Option>) => {
    if (!steps) return;
    commit(
      steps.map((s) =>
        s.key === stepKey
          ? { ...s, options: s.options.map((o, i) => (i === optIndex ? { ...o, ...patch } : o)) }
          : s
      )
    );
  };

  const addOption = (stepKey: string) => {
    if (!steps) return;
    commit(
      steps.map((s) => (s.key === stepKey ? { ...s, options: [...s.options, { label: "", target: "" }] } : s))
    );
  };

  const removeOption = (stepKey: string, optIndex: number) => {
    if (!steps) return;
    commit(
      steps.map((s) =>
        s.key === stepKey && s.options.length > 1
          ? { ...s, options: s.options.filter((_, i) => i !== optIndex) }
          : s
      )
    );
  };

  // "+ Create a new step" chosen from an option's target dropdown: creates the step and wires this option to it.
  const createStepForOption = (stepKey: string, optIndex: number) => {
    if (!steps) return;
    const newStep: Step = { key: nextKey(), text: "", kind: "question", options: [{ label: "", target: "" }, { label: "", target: "" }] };
    const withNewStep = steps.map((s) =>
      s.key === stepKey ? { ...s, options: s.options.map((o, i) => (i === optIndex ? { ...o, target: newStep.key } : o)) } : s
    );
    commit([...withNewStep, newStep]);
  };

  if (!steps) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center space-y-2">
        <p className="text-xs font-bold text-zinc-600">No step-by-step troubleshooting guide yet.</p>
        <p className="text-[10px] text-zinc-450 font-medium max-w-sm mx-auto">
          Build a simple guide: ask a question, offer a couple of answer choices, and each choice leads to
          the next question or a final result — no code needed.
        </p>
        <button
          type="button"
          onClick={start}
          className="mt-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 px-4 py-2 text-xs font-bold text-white transition-all"
        >
          + Create a Troubleshooting Guide
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={step.key} className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
              Step {index + 1} {index === 0 && <span className="text-zinc-350 font-semibold">(starting question)</span>}
            </span>
            <button
              type="button"
              onClick={() => removeStep(step.key)}
              disabled={steps.length <= 1}
              className="text-[10px] font-bold text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Remove step
            </button>
          </div>

          <textarea
            rows={2}
            value={step.text}
            onChange={(e) => updateStep(step.key, { text: e.target.value })}
            placeholder="What question or instruction should the agent/customer see here?"
            className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-xs text-zinc-850 focus:outline-hidden shadow-inner"
          />

          <div className="flex items-center gap-4 text-[11px] font-semibold text-zinc-600">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={step.kind === "question"}
                onChange={() => updateStep(step.key, { kind: "question", options: step.options.length ? step.options : [{ label: "", target: "" }, { label: "", target: "" }] })}
              />
              Ask a question with choices
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={step.kind !== "question"}
                onChange={() => updateStep(step.key, { kind: "resolve" })}
              />
              This is a final answer
            </label>
          </div>

          {step.kind === "question" ? (
            <div className="space-y-2 pl-3 border-l-2 border-zinc-100">
              {step.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(step.key, i, { label: e.target.value })}
                    placeholder={`Choice ${i + 1} (e.g. "Yes")`}
                    className="flex-1 rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] text-zinc-850 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-zinc-400 font-semibold shrink-0">then go to</span>
                  <select
                    value={opt.target}
                    onChange={(e) => {
                      if (e.target.value === "__new__") createStepForOption(step.key, i);
                      else updateOption(step.key, i, { target: e.target.value });
                    }}
                    className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-[11px] text-zinc-850 focus:outline-hidden max-w-[180px]"
                  >
                    <option value="">— choose a step —</option>
                    <option value="__new__">+ Create a new step</option>
                    {steps
                      .filter((s) => s.key !== step.key)
                      .map((s) => (
                        <option key={s.key} value={s.key}>
                          {stepLabel(s, steps.findIndex((x) => x.key === s.key))}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeOption(step.key, i)}
                    disabled={step.options.length <= 1}
                    className="text-zinc-350 hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed shrink-0 text-sm font-bold px-1"
                    title="Remove choice"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(step.key)}
                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900"
              >
                + Add another choice
              </button>
            </div>
          ) : (
            <div className="pl-3 border-l-2 border-zinc-100">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-450 block mb-1">Outcome</label>
              <select
                value={step.kind}
                onChange={(e) => updateStep(step.key, { kind: e.target.value as "resolve" | "escalate" })}
                className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-[11px] text-zinc-850 focus:outline-hidden"
              >
                <option value="resolve">Problem solved — no escalation needed</option>
                <option value="escalate">Needs escalation to another team</option>
              </select>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addStep}
          className="rounded-lg border border-zinc-250 bg-white hover:bg-zinc-50 px-3 py-1.5 text-[11px] font-bold text-zinc-700 shadow-2xs"
        >
          + Add another step
        </button>
        <button type="button" onClick={removeGuide} className="text-[10px] font-bold text-red-400 hover:text-red-600">
          Remove entire guide
        </button>
      </div>

      <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
        <span className="text-[10px] text-zinc-450 font-bold uppercase block mb-3">Preview — this is what agents/customers will see:</span>
        <TroubleshootingPlayer flow={JSON.parse(stepsToFlowJson(steps) || "null")} />
      </div>

      <details className="text-[10px]">
        <summary
          className="cursor-pointer font-bold text-zinc-400 hover:text-zinc-600 select-none"
          onClick={(e) => {
            e.preventDefault();
            setShowAdvanced((v) => !v);
          }}
        >
          {showAdvanced ? "Hide" : "Show"} advanced (raw JSON, for developers)
        </summary>
        {showAdvanced && (
          <textarea
            rows={6}
            value={value}
            readOnly
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[10px] text-zinc-600 font-mono"
          />
        )}
      </details>
    </div>
  );
}
