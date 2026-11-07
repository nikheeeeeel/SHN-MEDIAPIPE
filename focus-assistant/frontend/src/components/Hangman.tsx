import { hangmanParts, HANGMAN_MAX_PARTS } from "../lib/hangman";

interface HangmanProps {
  flags: number;
  tone?: "warn" | "danger";
  className?: string;
}

export function Hangman({
  flags,
  tone = "warn",
  className = "text-warn",
}: HangmanProps) {
  const parts = hangmanParts(flags);
  const color = tone === "danger" ? "text-danger" : className;

  return (
    <svg
      viewBox="0 0 160 160"
      role="img"
      aria-label={`Hangman drawing, ${parts} of ${HANGMAN_MAX_PARTS} parts drawn`}
      className={`h-32 w-32 ${color}`}
    >
      <g
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        className="opacity-25"
      >
        <line x1="20" y1="146" x2="132" y2="146" />
        <line x1="58" y1="146" x2="58" y2="20" />
        <line x1="58" y1="20" x2="112" y2="20" />
        <line x1="112" y1="20" x2="112" y2="38" />
      </g>

      <g
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        className="transition-opacity duration-200"
      >
        {parts >= 1 && <circle cx="112" cy="54" r="16" />}
        {parts >= 2 && <line x1="112" y1="70" x2="112" y2="106" />}
        {parts >= 3 && <line x1="112" y1="80" x2="92" y2="96" />}
        {parts >= 4 && <line x1="112" y1="80" x2="132" y2="96" />}
        {parts >= 5 && <line x1="112" y1="106" x2="92" y2="132" />}
        {parts >= 6 && <line x1="112" y1="106" x2="132" y2="132" />}
      </g>
    </svg>
  );
}
