"use client";

import { useEffect, useRef, useState } from "react";
import { PIN_LENGTH } from "../../lib/vault/device";
import styles from "./vault.module.css";

/**
 * Six masked digit boxes. Typing moves forward, Backspace moves back, pasting
 * a 6-digit code fills all boxes. Calls onComplete when all digits are in.
 * Change `resetKey` to clear it (e.g. after a wrong PIN).
 */
export default function PinInput({
  onComplete,
  disabled,
  error,
  resetKey,
  label,
}: {
  onComplete: (pin: string) => void;
  disabled?: boolean;
  error?: boolean;
  resetKey?: unknown;
  label: string;
}) {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setDigits(Array(PIN_LENGTH).fill(""));
    boxes.current[0]?.focus();
  }, [resetKey]);

  const update = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== "")) onComplete(next.join(""));
  };

  const onChange = (i: number, value: string) => {
    const nums = value.replace(/\D/g, "");
    if (!nums) return;
    const next = [...digits];
    // Typing or pasting: fill from this box onward
    nums.split("").slice(0, PIN_LENGTH - i).forEach((d, k) => (next[i + k] = d));
    update(next);
    boxes.current[Math.min(i + nums.length, PIN_LENGTH - 1)]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) next[i] = "";
      else if (i > 0) {
        next[i - 1] = "";
        boxes.current[i - 1]?.focus();
      }
      setDigits(next);
    } else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < PIN_LENGTH - 1) boxes.current[i + 1]?.focus();
  };

  return (
    <div className={`${styles.pin} ${error ? styles.pinError : ""}`} role="group" aria-label={label} key={String(resetKey)}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          className={styles.pinBox}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={PIN_LENGTH}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          autoFocus={i === 0}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
