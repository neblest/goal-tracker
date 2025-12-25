import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-[#E5DDD5] bg-white px-3 py-2 text-sm text-[#4A3F35]",
          "placeholder:text-[#A89F94] hover:border-[#D4A574] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A574]/20 focus-visible:border-[#D4A574]",
          "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
