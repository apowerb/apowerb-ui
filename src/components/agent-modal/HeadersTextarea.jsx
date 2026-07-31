"use client";

import { useState } from "react";

export default function HeadersTextarea({ value, onChange }) {
  const [text, setText] = useState(
    typeof value === "object" && Object.keys(value || {}).length > 0
      ? JSON.stringify(value, null, 2)
      : ""
  );

  const handleBlur = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange({});
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      onChange(parsed);
    } catch {
      // Invalid JSON — keep local text, don't propagate
    }
  };

  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      placeholder='{"Authorization": "Bearer ..."}'
      rows={2}
      className="glass-input w-full px-3 py-2 rounded-lg text-sm resize-none font-mono"
    />
  );
}
