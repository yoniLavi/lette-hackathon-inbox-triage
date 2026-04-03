/**
 * Integration tests for the CRM API.
 *
 * Requires the Docker Compose stack to be running:
 *   docker compose up -d
 */

import { describe, test, expect } from "vitest";

const CRM_URL = process.env.CRM_API_URL || "http://localhost:8002";

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${CRM_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data: data as Record<string, unknown> };
}

async function apiGet(
  path: string,
  params?: Record<string, string>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const url = new URL(path, CRM_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data: data as Record<string, unknown> };
}

test("health", async () => {
  const { status, data } = await apiGet("/health");
  expect(status).toBe(200);
  expect(data.status).toBe("ok");
});

test("counts", async () => {
  const { status, data } = await apiGet("/api/counts");
  expect(status).toBe(200);
  expect(data).toHaveProperty("emails");
  expect(data).toHaveProperty("open_tasks");
  expect(data).toHaveProperty("closed_cases");
});

test("list properties", async () => {
  const { status, data } = await apiGet("/api/properties");
  expect(status).toBe(200);
  expect(data).toHaveProperty("list");
  expect(data).toHaveProperty("total");
});

test("CRUD lifecycle", async () => {
  // Create
  const { status: cs, data: created } = await api("POST", "/api/cases", {
    name: "Test Case",
    status: "new",
    priority: "medium",
  });
  expect(cs).toBe(201);
  expect(created.name).toBe("Test Case");
  const id = created.id as number;

  // Read
  const { status: gs, data: got } = await apiGet(`/api/cases/${id}`);
  expect(gs).toBe(200);
  expect(got.name).toBe("Test Case");

  // Update
  const { status: us, data: updated } = await api("PATCH", `/api/cases/${id}`, {
    status: "closed",
  });
  expect(us).toBe(200);
  expect(updated.status).toBe("closed");

  // Delete
  const { status: ds } = await api("DELETE", `/api/cases/${id}`);
  expect(ds).toBe(200);

  // Verify deleted
  const { status: vs } = await apiGet(`/api/cases/${id}`);
  expect(vs).toBe(404);
});

test("list with filters", async () => {
  const e1 = await api("POST", "/api/emails", {
    subject: "Test Draft",
    status: "draft",
    from_address: "test@test.com",
  });
  const e2 = await api("POST", "/api/emails", {
    subject: "Test Archived",
    status: "archived",
    from_address: "test@test.com",
  });
  expect(e1.status).toBe(201);
  expect(e2.status).toBe(201);

  const { data } = await apiGet("/api/emails", { status: "draft" });
  const list = data.list as Record<string, unknown>[];
  expect(list.every((e) => e.status === "draft")).toBe(true);

  // Clean up
  await api("DELETE", `/api/emails/${e1.data.id}`);
  await api("DELETE", `/api/emails/${e2.data.id}`);
});

test("full-text search", async () => {
  const e = await api("POST", "/api/emails", {
    subject: "URGENT water leak in bedroom",
    body: "Water is coming through the ceiling and damaging the floor",
    status: "archived",
    from_address: "tenant@test.com",
  });
  expect(e.status).toBe(201);
  const emailId = e.data.id as number;

  const { data } = await apiGet("/api/emails", { search: "water leak" });
  expect((data.total as number) >= 1).toBe(true);
  const found = (data.list as Record<string, unknown>[]).some(
    (em) => em.id === emailId,
  );
  expect(found).toBe(true);

  await api("DELETE", `/api/emails/${emailId}`);
});

test("unknown entity returns 404", async () => {
  const { status } = await apiGet("/api/nonexistent");
  expect(status).toBe(404);
});

describe("thread auto-creation", () => {
  test("thread auto-created on email insert", async () => {
    const e1 = await api("POST", "/api/emails", {
      subject: "Thread test",
      from_address: "sender@test.com",
      thread_id: "test_thread_auto",
      thread_position: 1,
      date_sent: "2026-03-09T10:00:00Z",
      is_read: false,
    });
    const e2 = await api("POST", "/api/emails", {
      subject: "Re: Thread test",
      from_address: "reply@test.com",
      thread_id: "test_thread_auto",
      thread_position: 2,
      date_sent: "2026-03-09T11:00:00Z",
      is_read: false,
    });
    expect(e1.status).toBe(201);
    expect(e2.status).toBe(201);

    const { data } = await apiGet("/api/threads", { limit: "500" });
    const threads = data.list as Record<string, unknown>[];
    const thread = threads.find((t) => t.thread_id === "test_thread_auto");
    expect(thread).toBeDefined();
    expect(thread!.email_count).toBe(2);
    expect(thread!.is_read).toBe(false);

    await api("DELETE", `/api/emails/${e1.data.id}`);
    await api("DELETE", `/api/emails/${e2.data.id}`);
  });

  test("thread is_read when all emails read", async () => {
    const e1 = await api("POST", "/api/emails", {
      subject: "Read test",
      from_address: "a@test.com",
      thread_id: "test_thread_read",
      thread_position: 1,
      date_sent: "2026-03-09T10:00:00Z",
      is_read: true,
    });
    const e2 = await api("POST", "/api/emails", {
      subject: "Re: Read test",
      from_address: "b@test.com",
      thread_id: "test_thread_read",
      thread_position: 2,
      date_sent: "2026-03-09T11:00:00Z",
      is_read: false,
    });
    expect(e1.status).toBe(201);
    expect(e2.status).toBe(201);

    let { data } = await apiGet("/api/threads", { limit: "500" });
    let thread = (data.list as Record<string, unknown>[]).find(
      (t) => t.thread_id === "test_thread_read",
    );
    expect(thread!.is_read).toBe(false);

    // Mark second email as read
    await api("PATCH", `/api/emails/${e2.data.id}`, { is_read: true });

    ({ data } = await apiGet("/api/threads", { limit: "500" }));
    thread = (data.list as Record<string, unknown>[]).find(
      (t) => t.thread_id === "test_thread_read",
    );
    expect(thread!.is_read).toBe(true);

    await api("DELETE", `/api/emails/${e1.data.id}`);
    await api("DELETE", `/api/emails/${e2.data.id}`);
  });

  test("thread is_read ignores drafts", async () => {
    const e1 = await api("POST", "/api/emails", {
      subject: "Draft ignore test",
      from_address: "tenant@test.com",
      thread_id: "test_thread_drafts",
      thread_position: 1,
      date_sent: "2026-03-09T10:00:00Z",
      is_read: true,
      status: "archived",
    });
    expect(e1.status).toBe(201);

    let { data } = await apiGet("/api/threads", { limit: "500" });
    let thread = (data.list as Record<string, unknown>[]).find(
      (t) => t.thread_id === "test_thread_drafts",
    );
    expect(thread!.is_read).toBe(true);

    const draft = await api("POST", "/api/emails", {
      subject: "Re: Draft ignore test",
      from_address: "manager@manageco.ie",
      thread_id: "test_thread_drafts",
      thread_position: 2,
      is_read: false,
      status: "draft",
    });
    expect(draft.status).toBe(201);

    ({ data } = await apiGet("/api/threads", { limit: "500" }));
    thread = (data.list as Record<string, unknown>[]).find(
      (t) => t.thread_id === "test_thread_drafts",
    );
    expect(thread!.is_read).toBe(true);

    await api("DELETE", `/api/emails/${draft.data.id}`);
    await api("DELETE", `/api/emails/${e1.data.id}`);
  });
});

describe("includes", () => {
  test("case with includes", async () => {
    const cs = await api("POST", "/api/cases", {
      name: "Include test case",
      status: "new",
    });
    const task = await api("POST", "/api/tasks", {
      name: "Include test task",
      case_id: cs.data.id,
    });
    const note = await api("POST", "/api/notes", {
      content: "Include test note",
      case_id: cs.data.id,
    });

    const { status, data } = await apiGet(`/api/cases/${cs.data.id}`, {
      include: "tasks,notes",
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty("tasks");
    expect(data).toHaveProperty("notes");
    expect(
      (data.tasks as Record<string, unknown>[]).some(
        (t) => t.id === task.data.id,
      ),
    ).toBe(true);
    expect(
      (data.notes as Record<string, unknown>[]).some(
        (n) => n.id === note.data.id,
      ),
    ).toBe(true);

    await api("DELETE", `/api/notes/${note.data.id}`);
    await api("DELETE", `/api/tasks/${task.data.id}`);
    await api("DELETE", `/api/cases/${cs.data.id}`);
  });

  test("thread with includes", async () => {
    const e = await api("POST", "/api/emails", {
      subject: "Thread include test",
      from_address: "inc@test.com",
      thread_id: "test_thread_include",
      thread_position: 1,
      date_sent: "2026-03-09T10:00:00Z",
    });
    expect(e.status).toBe(201);

    const { data: listData } = await apiGet("/api/threads", { limit: "500" });
    const thread = (listData.list as Record<string, unknown>[]).find(
      (t) => t.thread_id === "test_thread_include",
    );
    expect(thread).toBeDefined();

    const { status, data } = await apiGet(`/api/threads/${thread!.id}`, {
      include: "emails",
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty("emails");
    expect((data.emails as Record<string, unknown>[]).length).toBe(1);
    expect((data.emails as Record<string, unknown>[])[0].id).toBe(e.data.id);

    await api("DELETE", `/api/emails/${e.data.id}`);
  });
});

describe("shift endpoints", () => {
  test("shift/next returns unread thread", async () => {
    const e = await api("POST", "/api/emails", {
      subject: "Shift next test",
      from_address: "shift@test.com",
      thread_id: "test_thread_shift",
      thread_position: 1,
      date_sent: "2026-03-09T09:00:00Z",
      is_read: false,
    });
    expect(e.status).toBe(201);

    const { status, data } = await apiGet("/api/shift/next");
    expect(status).toBe(200);
    expect(data.thread).not.toBeNull();
    expect(
      (data.thread as Record<string, unknown>).emails,
    ).toBeDefined();

    await api("DELETE", `/api/emails/${e.data.id}`);
  });

  test("shift/next returns null when all read", async () => {
    const e = await api("POST", "/api/emails", {
      subject: "All read test",
      from_address: "done@test.com",
      thread_id: "test_thread_allread",
      thread_position: 1,
      date_sent: "2026-03-09T09:00:00Z",
      is_read: true,
    });
    expect(e.status).toBe(201);

    const { data } = await apiGet("/api/shift/next");
    if (data.thread !== null) {
      expect(
        (data.thread as Record<string, unknown>).thread_id,
      ).not.toBe("test_thread_allread");
    }

    await api("DELETE", `/api/emails/${e.data.id}`);
  });

  test("shift/complete marks emails read", async () => {
    const e1 = await api("POST", "/api/emails", {
      subject: "Complete test 1",
      from_address: "a@test.com",
      thread_id: "test_thread_complete",
      thread_position: 1,
      date_sent: "2026-03-09T10:00:00Z",
      is_read: false,
    });
    const e2 = await api("POST", "/api/emails", {
      subject: "Re: Complete test 1",
      from_address: "b@test.com",
      thread_id: "test_thread_complete",
      thread_position: 2,
      date_sent: "2026-03-09T11:00:00Z",
      is_read: false,
    });
    expect(e1.status).toBe(201);
    expect(e2.status).toBe(201);

    const ids = [e1.data.id as number, e2.data.id as number];
    const { status, data } = await api("POST", "/api/shift/complete", {
      email_ids: ids,
      thread_id: "test_thread_complete",
    });
    expect(status).toBe(200);
    expect(data.emails_updated).toBe(2);

    for (const eid of ids) {
      const { data: email } = await apiGet(`/api/emails/${eid}`);
      expect(email.is_read).toBe(true);
    }

    const { data: threadsData } = await apiGet("/api/threads", {
      limit: "500",
    });
    const thread = (threadsData.list as Record<string, unknown>[]).find(
      (t) => t.thread_id === "test_thread_complete",
    );
    expect(thread!.is_read).toBe(true);

    for (const eid of ids) {
      await api("DELETE", `/api/emails/${eid}`);
    }
  });
});

describe("bulk email update", () => {
  test("bulk update emails", async () => {
    const e1 = await api("POST", "/api/emails", {
      subject: "Bulk 1",
      from_address: "bulk@test.com",
      is_read: false,
    });
    const e2 = await api("POST", "/api/emails", {
      subject: "Bulk 2",
      from_address: "bulk@test.com",
      is_read: false,
    });
    expect(e1.status).toBe(201);
    expect(e2.status).toBe(201);

    const ids = [e1.data.id as number, e2.data.id as number];
    const { status, data } = await api("PATCH", "/api/emails/bulk", {
      ids,
      updates: { is_read: true },
    });
    expect(status).toBe(200);
    expect(data.updated).toBe(2);

    for (const eid of ids) {
      const { data: email } = await apiGet(`/api/emails/${eid}`);
      expect(email.is_read).toBe(true);
    }

    for (const eid of ids) {
      await api("DELETE", `/api/emails/${eid}`);
    }
  });
});

test("property manager_email", async () => {
  const { status, data } = await api("POST", "/api/properties", {
    name: "Test Property",
    type: "BTR",
    manager: "John Smith",
    manager_email: "john.smith@manageco.ie",
  });
  expect(status).toBe(201);
  expect(data.manager_email).toBe("john.smith@manageco.ie");

  await api("DELETE", `/api/properties/${data.id}`);
});

describe("shift entity", () => {
  test("shift CRUD", async () => {
    const { status: cs, data: shift } = await api("POST", "/api/shifts", {
      status: "in_progress",
    });
    expect(cs).toBe(201);
    expect(shift.status).toBe("in_progress");
    expect(shift.threads_processed).toBe(0);
    const shiftId = shift.id as number;

    const { status: us, data: updated } = await api(
      "PATCH",
      `/api/shifts/${shiftId}`,
      {
        status: "completed",
        threads_processed: 5,
        emails_processed: 12,
        drafts_created: 3,
        tasks_created: 2,
        summary: "Processed 5 threads.",
      },
    );
    expect(us).toBe(200);
    expect(updated.status).toBe("completed");
    expect(updated.threads_processed).toBe(5);

    const { status: ls, data: listData } = await apiGet("/api/shifts", {
      order_by: "started_at",
      order: "desc",
    });
    expect(ls).toBe(200);
    expect((listData.total as number) >= 1).toBe(true);
    expect(
      (listData.list as Record<string, unknown>[]).some(
        (s) => s.id === shiftId,
      ),
    ).toBe(true);

    await api("DELETE", `/api/shifts/${shiftId}`);
  });

  test("shift include notes", async () => {
    const shift = await api("POST", "/api/shifts", {
      status: "completed",
      summary: "Test shift",
    });
    const note = await api("POST", "/api/notes", {
      content: "Thread 1: processed",
      shift_id: shift.data.id,
    });

    const { status, data } = await apiGet(`/api/shifts/${shift.data.id}`, {
      include: "notes",
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty("notes");
    expect(
      (data.notes as Record<string, unknown>[]).some(
        (n) => n.id === note.data.id,
      ),
    ).toBe(true);
    expect((data.notes as Record<string, unknown>[])[0].shift_id).toBe(
      shift.data.id,
    );

    await api("DELETE", `/api/notes/${note.data.id}`);
    await api("DELETE", `/api/shifts/${shift.data.id}`);
  });
});
