import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("rounded-lg border border-[#0F1016]/10 bg-white shadow-sm transition-colors duration-200", className)}
            {...props}
        />
    )
)
Card.displayName = "Card"

export { Card }
