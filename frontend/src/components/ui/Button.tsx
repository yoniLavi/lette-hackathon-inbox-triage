import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost"
    size?: "fixed" | "sm" | "md" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", ...props }, ref) => {

        const variants = {
            primary: "bg-[#0000EE] text-white hover:bg-[#0000CC] border border-transparent shadow-sm",
            secondary: "bg-[#EDEDE9] text-[#0F1016] border border-[#0F1016]/20 hover:bg-[#E5E5E0] hover:text-[#0000EE] hover:border-[#0000EE]/50",
            ghost: "bg-transparent text-[#0000EE] hover:bg-[#0000EE]/10 hover:text-[#0000CC]",
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
                    "inline-flex items-center justify-center rounded-lg font-sans transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0000EE]",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
