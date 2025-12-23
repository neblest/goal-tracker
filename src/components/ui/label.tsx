import * as React from "react";

import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & {
    requiredText?: string;
  }
>(({ className, requiredText, children, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  >
    {children}
    {requiredText ? <span className="ml-1 text-destructive">{requiredText}</span> : null}
  </label>
));
Label.displayName = "Label";

export { Label };
