export type UrgencyTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Situation {
    id: string;
    title: string;
    property: string;
    unit?: string;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    tier: UrgencyTier;
    financialExposure?: number;
    aiSummary: string;
    emailsCount: number;
}

export const mockSituations: Situation[] = [
    {
        id: "sit-1",
        title: "Water Leak - Unit 4B",
        property: "Citynorth Quarter",
        unit: "Unit 4B",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        updatedAt: new Date(Date.now() - 20 * 60 * 1000),     // 20 mins ago
        type: "Maintenance Emergency",
        tier: "CRITICAL",
        financialExposure: 2500,
        aiSummary: "Tenant Maria Santos reported a water leak from ceiling at 7:15am. Water is still flowing and damaging furniture. No contractor assigned yet.",
        emailsCount: 3
    },
    {
        id: "sit-2",
        title: "LPT Returns - 5 Properties",
        property: "Multiple",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),  // 5 hours ago
        type: "Compliance",
        tier: "HIGH",
        financialExposure: 82000,
        aiSummary: "Local Property Tax (LPT) returns are due in 19 days for 5 properties in the Reds Works and Graylings portfolios.",
        emailsCount: 1
    },
    {
        id: "sit-3",
        title: "Gas Cert Renewal - Thornbury",
        property: "Thornbury Village",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        type: "Compliance",
        tier: "MEDIUM",
        aiSummary: "Gas safety certificates expiring in 30 days. Need to coordinate with contractor.",
        emailsCount: 2
    },
    {
        id: "sit-4",
        title: "Lease Renewal Option - Unit 2A",
        property: "Ilah Residences",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        type: "Lease Renewal",
        tier: "LOW",
        aiSummary: "Tenant has 60 days remaining on lease. Asking if rent will increase.",
        emailsCount: 1
    }
];

export interface Activity {
    id: string;
    type: "email" | "system" | "agent";
    title: string;
    description: string;
    timestamp: Date;
    status?: "success" | "info" | "warning";
}

export const mockActivities: Activity[] = [
    {
        id: "act-1",
        type: "email",
        title: "New email: Maria Santos",
        description: "Re: Heating still not fixed → Linked to Case #034",
        timestamp: new Date(Date.now() - 12 * 60 * 1000)
    },
    {
        id: "act-2",
        type: "system",
        title: "Case closed: Gas cert",
        description: "Thornbury Village • By: John K.",
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        status: "success"
    },
    {
        id: "act-3",
        type: "agent",
        title: "Agent processed 23 emails",
        description: "2 new situations created",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: "info"
    }
];
