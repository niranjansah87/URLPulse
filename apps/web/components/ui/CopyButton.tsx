"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton } from "./Button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <IconButton label={copied ? "Copied" : label} onClick={copy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </IconButton>
  );
}
