"use client";
import { useState, useTransition } from "react";
import { selectOption, sendCustomerMessage } from "@/app/actions/inquiries";
import { Spinner } from "@/components/ui";

export function CustomerActions({ inquiryId, candidateId, mode }: { inquiryId: string; candidateId?: string; mode: "select" | "message" }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (mode === "select" && candidateId) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => start(async () => {
            const r = await selectOption(inquiryId, candidateId);
            if ("error" in r) setMsg(r.error ?? null);
          })}
          disabled={pending}
          className="btn-primary btn-sm"
        >
          {pending ? <Spinner /> : null} Choose this option
        </button>
        {msg ? <span className="text-[13px] text-rope-700">{msg}</span> : null}
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await sendCustomerMessage(inquiryId, text);
          if ("error" in r) setMsg(r.error ?? null);
          else {
            setText("");
            setMsg(null);
          }
        });
      }}
      className="mt-3 flex flex-col gap-2 sm:flex-row"
    >
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question or update your request…" className="input flex-1" />
      <button disabled={pending || !text.trim()} className="btn-dark">
        {pending ? <Spinner /> : null} Send
      </button>
      {msg ? <span className="text-[13px] text-rope-700">{msg}</span> : null}
    </form>
  );
}
