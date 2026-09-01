import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

/** Native select styled to the design system — keyboard/screen-reader behavior for free. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <span className={cn(styles.selectWrap, className)}>
      <select ref={ref} className={styles.select} {...rest}>
        {children}
      </select>
      <ChevronDown size={14} className={styles.selectChevron} aria-hidden />
    </span>
  );
});
