"use client";

import { useState } from "react";
import { getFreeTools } from "../lib/tools";

export default function ToolDropdown() {
  const [open, setOpen] = useState(false);
  const tools = getFreeTools();

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        style={{
          background: "transparent",
          color: "var(--text)",
          border: "none",
          fontSize: "15px",
          fontWeight: 500,
          padding: "8px 4px",
        }}
      >
        Free Tool ▾
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            minWidth: "240px",
            padding: "8px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            zIndex: 50,
          }}
        >
          {tools.map((tool) => (
            <a
              key={tool.id}
              href={tool.route}
              style={{
                display: "block",
                padding: "10px 12px",
                borderRadius: "8px",
                color: "var(--text)",
                fontSize: "14px",
              }}
            >
              {tool.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}