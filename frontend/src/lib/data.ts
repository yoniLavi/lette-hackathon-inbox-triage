export type UrgencyTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Activity {
    id: string | number;
    type: "email" | "system" | "agent";
    title: string;
    description: string;
    timestamp: Date;
    status?: "success" | "info" | "warning";
}
