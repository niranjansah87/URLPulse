"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Cycles through phrases with a type/delete effect and a blinking caret. Purely
 * decorative: callers pair it with a visually-hidden static phrase for screen
 * readers, and it renders the first phrase statically under prefers-reduced-motion.
 */
export function Typewriter({ words, className, caretClassName }: { words: string[]; className?: string; caretClassName?: string }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const word = words[index % words.length] ?? "";
    const atFull = !deleting && text === word;
    const atEmpty = deleting && text === "";

    const delay = atFull ? 1600 : atEmpty ? 240 : deleting ? 45 : 85;
    const timer = setTimeout(() => {
      if (atFull) {
        setDeleting(true);
      } else if (atEmpty) {
        setDeleting(false);
        setIndex((n) => (n + 1) % words.length);
      } else {
        setText(deleting ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1));
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [text, deleting, index, words, reduce]);

  return (
    <span className={className} aria-hidden>
      {reduce ? words[0] : text}
      <span className={caretClassName}>|</span>
    </span>
  );
}
