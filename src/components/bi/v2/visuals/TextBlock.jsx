"use client";

import { useDashboardLocale } from "../DashboardDataContext";
import { splitNumbers } from "../format";

/** The summary sentence: plain text from the server, figures set in bold. */
export default function TextBlock({ result }) {
  const locale = useDashboardLocale();
  const text = result?.text;
  if (!text) return null;
  return (
    <p className="bi-v2-num text-sm leading-normal th-text-secondary sm:text-[15px]" data-testid="v2-text">
      {splitNumbers(text, locale).map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-semibold th-text">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}
