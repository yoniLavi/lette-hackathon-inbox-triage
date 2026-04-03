const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:8002";

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

export async function request(
  method: string,
  path: string,
  options?: { params?: Record<string, string>; body?: unknown },
): Promise<unknown> {
  const url = new URL(`/api/${path}`, CRM_API_URL);
  if (options?.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v);
    }
  }

  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
  };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), init);
  } catch {
    die(`Error: cannot connect to CRM API at ${CRM_API_URL}`);
  }

  if (!res.ok) {
    const text = await res.text();
    let detail: string;
    try {
      detail = JSON.parse(text).detail || text;
    } catch {
      detail = text;
    }
    die(`Error: ${detail}`);
  }

  return res.json();
}

export function output(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
