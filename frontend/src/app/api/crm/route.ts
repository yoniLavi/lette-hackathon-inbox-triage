import { NextRequest, NextResponse } from "next/server";

const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:8002";

/**
 * Proxy GET requests to the CRM API.
 * Usage: /api/crm?path=emails&order_by=date_sent&order=desc&limit=20
 */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const path = searchParams.get("path");
    if (!path) {
        return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    const url = new URL(`/api/${path}`, CRM_API_URL);
    // Forward all params except "path"
    for (const [key, value] of searchParams.entries()) {
        if (key !== "path") {
            url.searchParams.set(key, value);
        }
    }

    const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
    });

    if (!res.ok) {
        return NextResponse.json(
            { error: `CRM API ${res.status}: ${res.statusText}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
}

/**
 * Proxy POST requests to the CRM API.
 * Usage: /api/crm?path=notes  with JSON body
 */
export async function POST(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const path = searchParams.get("path");
    if (!path) {
        return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    const body = await req.json();
    const url = new URL(`/api/${path}`, CRM_API_URL);

    const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        return NextResponse.json(
            { error: `CRM API ${res.status}: ${res.statusText}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
}

/**
 * Proxy DELETE requests to the CRM API.
 * Usage: /api/crm?path=emails/42
 */
export async function DELETE(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const path = searchParams.get("path");
    if (!path) {
        return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    const url = new URL(`/api/${path}`, CRM_API_URL);

    const res = await fetch(url.toString(), { method: "DELETE" });

    if (!res.ok) {
        return NextResponse.json(
            { error: `CRM API ${res.status}: ${res.statusText}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
}

/**
 * Proxy PATCH requests to the CRM API.
 * Usage: /api/crm?path=tasks/5  with JSON body
 */
export async function PATCH(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const path = searchParams.get("path");
    if (!path) {
        return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    const body = await req.json();
    const url = new URL(`/api/${path}`, CRM_API_URL);

    const res = await fetch(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        return NextResponse.json(
            { error: `CRM API ${res.status}: ${res.statusText}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
}
