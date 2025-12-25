import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#D4A574]/30",
  {
    variants: {
      variant: {
        default: "bg-[#D4A574] text-white shadow-sm hover:bg-[#C9965E] active:scale-[0.98]",
        destructive:
          "bg-[#C17A6F] text-white shadow-sm hover:bg-[#C17A6F]/90 focus-visible:ring-[#C17A6F]/30 active:scale-[0.98]",
        outline:
          "border border-[#E5DDD5] bg-white shadow-sm hover:bg-[#D4A574]/10 hover:border-[#D4A574] text-[#4A3F35]",
        secondary: "bg-[#E5DDD5] text-[#4A3F35] shadow-sm hover:bg-[#E5DDD5]/80",
        ghost: "hover:bg-[#D4A574]/10 text-[#4A3F35]",
        link: "text-[#D4A574] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-xl gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
