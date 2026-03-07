import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "outline"
    size?: "fixed" | "sm" | "md" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", ...props }, ref) => {

        const variants = {
            primary: "bg-[#0F1016] text-white hover:bg-[#0F1016]/90 shadow-sm",
            secondary: "bg-white border border-[#0F1016]/10 text-[#0F1016] hover:bg-[#EDEDE9] hover:text-[#0000EE] shadow-sm",
            ghost: "text-[#0000EE] hover:bg-[#0000EE]/10",
            outline: "border-2 border-[#0F1016]/10 text-[#0F1016] hover:border-[#0F1016]/30 hover:bg-[#EDEDE9]",
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
