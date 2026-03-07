import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "outline"
    size?: "fixed" | "sm" | "md" | "lg"
    withStripes?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", withStripes = true, children, ...props }, ref) => {

        const variants = {
            primary: "bg-[#0F1016] text-white hover:bg-[#0F1016]/90 shadow-sm relative overflow-hidden",
            secondary: "bg-white border border-[#0F1016]/10 text-[#0F1016] hover:bg-[#F2F2EC] hover:text-primary shadow-sm",
            ghost: "text-primary hover:bg-primary/10",
            outline: "border-2 border-[#0F1016]/10 text-[#0F1016] hover:border-[#0F1016]/30 hover:bg-[#F2F2EC]",
        }

        const sizes = {
            fixed: "",
            sm: "px-3 py-1.5 text-sm",
            md: "px-5 py-2.5 text-sm font-medium",
            lg: "px-7 py-3 text-base font-semibold",
        }

        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg font-sans transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            >
                {variant === "primary" && withStripes && (
                    <div className="absolute inset-0 bg-white opacity-10 bg-striped pointer-events-none" />
                )}
                <span className="relative z-10 flex items-center gap-2">
                    {children}
                </span>
            </button>
        )
    }
)
Button.displayName = "Button"

export { Button }
