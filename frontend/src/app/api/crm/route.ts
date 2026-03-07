import { NextRequest, NextResponse } from "next/server";

const ESPOCRM_URL = process.env.ESPOCRM_URL || "http://localhost:8080";
const ESPOCRM_API_KEY = process.env.ESPOCRM_API_KEY || "";

/**
 * Proxy GET requests to EspoCRM REST API.
 * Usage: /api/crm?path=Case&orderBy=modifiedAt&order=desc&maxSize=50
 */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const path = searchParams.get("path");
    if (!path) {
        return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    const url = new URL(`/api/v1/${path}`, ESPOCRM_URL);
    // Forward all params except "path"
    for (const [key, value] of searchParams.entries()) {
        if (key !== "path") {
            url.searchParams.set(key, value);
        }
    }

    const res = await fetch(url.toString(), {
        headers: {
            "X-Api-Key": ESPOCRM_API_KEY,
            "Content-Type": "application/json",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        return NextResponse.json(
            { error: `EspoCRM ${res.status}: ${res.statusText}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
}
