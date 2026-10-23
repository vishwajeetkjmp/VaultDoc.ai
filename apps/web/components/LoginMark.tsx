"use client";

import styles from "./navbar.module.css";

/**
 * Asterisk next to tools that need an account: red while logged out (the tool is locked),
 * green once logged in (unlocked).
 */
export default function LoginMark({ unlocked }: { unlocked: boolean }) {
  return (
    <span className={unlocked ? styles.markUnlocked : styles.markLocked} aria-hidden>
      *
    </span>
  );
}

export const LOGIN_TIP = "Log in to use this tool";
