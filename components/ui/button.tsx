import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonStyles = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent text-body font-medium whitespace-nowrap motion-safe:transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-w-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-field-border/30 dark:hover:bg-field-border/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-danger-soft text-danger hover:border-danger focus-visible:border-danger focus-visible:ring-danger/50",
        link: "text-foreground underline underline-offset-4",
      },
      size: {
        default: "h-10 gap-2 px-4 pointer-coarse:h-11",
        xs: "h-9 gap-2 px-2 pointer-coarse:h-11",
        sm: "h-9 gap-2 px-3 pointer-coarse:h-11",
        lg: "h-10 gap-2 px-6 pointer-coarse:h-11",
        icon: "size-10 pointer-coarse:size-11",
        "icon-xs": "size-9 pointer-coarse:size-11",
        "icon-sm": "size-9 pointer-coarse:size-11",
        "icon-lg": "size-10 pointer-coarse:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function buttonVariants(props?: Parameters<typeof buttonStyles>[0]) {
  return cn(buttonStyles(props))
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={typeof className === "function" ? (state) => cn(buttonVariants({ variant, size }), className(state)) : buttonVariants({ variant, size, className })}
      {...props}
    />
  )
}

export { Button, buttonVariants }
