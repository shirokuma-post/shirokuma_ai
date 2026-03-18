import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800":
              variant === "primary",
            "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50":
              variant === "secondary",
            "bg-accent-600 text-white hover:bg-accent-700":
              variant === "danger",
            "text-gray-600 hover:bg-gray-100 hover:text-gray-900":
              variant === "ghost",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2 text-sm": size === "md",
            "px-6 py-3 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
