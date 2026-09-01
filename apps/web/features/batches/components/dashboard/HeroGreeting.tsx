"use client";

import { useCurrentUser } from "@/features/auth/useCurrentUser";
import styles from "./dashboard.module.css";

/** "Welcome back, <first name>" - greets the signed-in user; falls back to a
 * plain greeting while the session loads or when no name is available. */
export function HeroGreeting() {
  const { user } = useCurrentUser();
  const first = user?.name?.trim().split(/\s+/)[0];
  return <div className={styles.overline}>Welcome back,{first ? ` ${first}` : ""}</div>;
}
