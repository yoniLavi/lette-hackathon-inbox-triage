"use client"

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, X, Send, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { usePageData, serializePageContext } from "@/lib/page-context";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface AIAction {
    action: "scrollTo" | "expand" | "navigate";
    target: { type: string; id?: string };
}

const WELCOME_MSG: Message = {
    id: "1",
    role: "assistant",
    content: "Hi! I'm your Lette AI assistant. I have access to the CRM — ask me about emails, contacts, or cases.",
    timestamp: new Date(),
};

const SUGGESTED_PROMPTS = [
    "What needs my attention first?",
    "Any urgent maintenance issues?",
    "Show me issues for Graylings",
    "Are there any overdue tasks?"
];

function loadMessages(): Message[] {
    if (typeof window === "undefined") return [WELCOME_MSG];
    try {
        const raw = sessionStorage.getItem("lette-chat");
        if (raw) {
            const parsed = JSON.parse(raw) as Message[];
            return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
        }
    } catch { /* ignore */ }
    return [WELCOME_MSG];
}

function saveMessages(msgs: Message[]) {
    try { sessionStorage.setItem("lette-chat", JSON.stringify(msgs)); } catch { /* ignore */ }
}

function saveIsOpen(open: boolean) {
    try { sessionStorage.setItem("lette-chat-open", open ? "true" : "false"); } catch { /* ignore */ }
}

/** Map a navigate action target to a URL path. */
function navigatePath(target: { type: string; id?: string; query?: string }): string | null {
    switch (target.type) {
        case "case": return target.id ? `/cases/${target.id}` : null;
        case "situation": return target.id ? `/cases/${target.id}` : null; // legacy alias
        case "dashboard": return "/";
        case "properties": return "/properties";
        case "property": return target.id ? `/properties/${target.id}` : "/properties";
        case "contacts": return "/contacts";
        case "contact": return target.id ? `/contacts/${target.id}` : "/contacts";
        case "inbox": return target.id ? `/inbox?email=${target.id}` : "/inbox";
        case "tasks": return "/tasks";
        case "search": return target.query ? `/search?q=${encodeURIComponent(target.query)}` : "/search";
        case "shifts": return "/shifts";
        default: return null;
    }
}

export function AIAssistant() {
    const { data: pageData } = usePageData();
    const router = useRouter();
    const [isOpen, _setIsOpen] = useState(false);
    const setIsOpen = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
        _setIsOpen(prev => {
            const next = typeof v === "function" ? v(prev) : v;
            if (!next) {
                // Clear highlights when chat is closed
                document.querySelectorAll(".ai-highlight").forEach(el => el.classList.remove("ai-highlight"));
            }
            saveIsOpen(next);
            return next;
        });
    }, []);

    // Restore open state from sessionStorage after hydration
    useEffect(() => {
        try {
            if (sessionStorage.getItem("lette-chat-open") === "true") {
                _setIsOpen(true);
            }
        } catch { /* ignore */ }
    }, []);
    const [messages, setMessages] = useState<Message[]>(loadMessages);
    const [inputValue, setInputValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [streamingText, setStreamingText] = useState("");
    const [workerTaskId, setWorkerTaskId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const queuedMessage = useRef<string | null>(null);
    const loadingRef = useRef(false);

    // Drag state
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            setDragOffset({
                x: dragStart.current.ox + (e.clientX - dragStart.current.x),
                y: dragStart.current.oy + (e.clientY - dragStart.current.y),
            });
        };
        const onUp = () => { dragging.current = false; };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, []);
    const pageDataRef = useRef(pageData);

    // Keep pageDataRef in sync with latest pageData
    useEffect(() => { pageDataRef.current = pageData; }, [pageData]);

    /** Wait for page context to change (e.g. after navigation). Resolves with serialized context. */
    const waitForContextUpdate = useCallback(async (timeoutMs = 8000): Promise<string> => {
        const startSnapshot = JSON.stringify(pageDataRef.current);
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            await new Promise(r => setTimeout(r, 200));
            const current = JSON.stringify(pageDataRef.current);
            if (current !== startSnapshot && pageDataRef.current) {
                // Give data a moment to settle (multiple setData calls)
                await new Promise(r => setTimeout(r, 300));
                return serializePageContext(pageDataRef.current);
            }
        }
        // Timeout — return whatever we have
        return serializePageContext(pageDataRef.current);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        saveMessages(messages);
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    useEffect(() => {
        if (isOpen && (loading || streamingText)) scrollToBottom();
    }, [streamingText, loading, isOpen]);

    const [statusText, setStatusText] = useState("");

    // Poll for background worker results
    useEffect(() => {
        if (!workerTaskId) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${AGENT_URL}/worker/status`);
                const data = await res.json();
                if (data.result) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: "assistant" as const,
                        content: data.result,
                        timestamp: new Date(),
                    }]);
                    setWorkerTaskId(null);
                }
            } catch { /* ignore */ }
        }, 2000);
        return () => clearInterval(interval);
    }, [workerTaskId]);

    const friendlyTool = (name: string) => {
        if (name.includes("crm") || name.includes("Bash")) {
            const action = name.split("__").pop() || name;
            return `CRM: ${action.replace(/_/g, " ")}`;
        }
        return name.replace(/_/g, " ");
    };

    const clearHighlights = () => {
        document.querySelectorAll(".ai-highlight").forEach(el => el.classList.remove("ai-highlight"));
    };

    const executeAction = (action: AIAction) => {
        if (action.action === "navigate") return; // navigate handled separately in sendOne
        const selector = `[data-ai-target="${action.target.type}-${action.target.id}"]`;
        const el = document.querySelector(selector);
        if (!el) {
            console.warn("[chat] action target not found:", selector);
            return;
        }

        clearHighlights();

        if (action.action === "expand") {
            // Dispatch a custom event that ThreadGroup listens for
            el.dispatchEvent(new CustomEvent("ai-expand", { bubbles: true }));
            setTimeout(() => {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ai-highlight");
            }, 150);
        } else {
            // scrollTo — expand any collapsed parent section first
            el.dispatchEvent(new CustomEvent("ai-expand", { bubbles: true }));
            setTimeout(() => {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ai-highlight");
            }, 250);
        }
    };

    const processStream = async (url: string, body: string): Promise<{ response: string; workerTaskId?: string; action?: AIAction }> => {
        console.log("[chat] fetch processStream called, url:", url);
        setStatusText("Connecting...");
        setStreamingText("");

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        });

        console.log("[chat] fetch response status:", res.status);

        if (res.status === 409) {
            console.log("[chat] Agent busy (409), restarting session and retrying...");
            setStatusText("Agent busy, restarting...");
            await fetch(`${AGENT_URL}/session/restart`, { method: "POST" });
            return processStream(url, body);
        }

        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";
        let finalResponse = "";
        let liveText = "";
        let returnedWorkerTaskId: string | undefined;
        let returnedAction: AIAction | undefined;

        console.log("[chat] starting stream read loop");

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log("[chat] stream done");
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete lines
            const parts = buffer.split("\n");
            buffer = parts.pop() || "";

            for (const line of parts) {
                if (line.startsWith("event: ")) {
                    currentEvent = line.slice(7);
                } else if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        console.log("[chat] SSE event:", currentEvent, Object.keys(data));
                        if (currentEvent === "status") {
                            const label = data.status === "connecting" ? "Connecting..."
                                : data.status === "querying_crm" ? "Searching CRM..."
                                : "Typing...";
                            setStatusText(label);
                        } else if (currentEvent === "tool_use") {
                            setStatusText(friendlyTool(data.tool));
                        } else if (currentEvent === "progress") {
                            setStatusText(data.text || "Working...");
                        } else if (currentEvent === "action") {
                            returnedAction = data as AIAction;
                            console.log("[chat] action received:", data);
                        } else if (currentEvent === "text") {
                            liveText = data.text;
                            setStreamingText(liveText);
                            setStatusText("");
                        } else if (currentEvent === "done") {
                            finalResponse = data.response;
                            if (data.worker_task_id) {
                                returnedWorkerTaskId = data.worker_task_id;
                            }
                        } else if (currentEvent === "error") {
                            throw new Error(data.detail);
                        }
                    } catch (e) {
                        if (e instanceof SyntaxError) continue;
                        throw e;
                    }
                }
            }
        }

        return {
            response: finalResponse || liveText || "(no response)",
            workerTaskId: returnedWorkerTaskId,
            action: returnedAction,
        };
    };

    const handleNewChat = async () => {
        clearHighlights();
        setMessages([WELCOME_MSG]);
        setLoading(false);
        setStatusText("");
        setStreamingText("");
        setWorkerTaskId(null);
        try {
            await fetch(`${AGENT_URL}/session/restart`, { method: "POST" });
        } catch { /* ignore */ }
    };

    const sendOne = async (text: string) => {
        clearHighlights();

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: text,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setLoading(true);
        loadingRef.current = true;
        setStatusText("Connecting...");
        setStreamingText("");

        try {
            const context = serializePageContext(pageData);
            const body = JSON.stringify({ message: text, context: context || undefined });
            const { response, workerTaskId: wid, action } = await processStream(`${AGENT_URL}/prompt/stream`, body);

            if (action?.action === "navigate") {
                // Navigate action: navigate to new page, wait for context, send follow-up
                const path = navigatePath(action.target);
                if (path) {
                    setStatusText("Navigating...");
                    setStreamingText("");
                    console.log("[chat] navigate action → %s", path);
                    router.push(path);

                    // Wait for new page context to load
                    const newContext = await waitForContextUpdate();
                    console.log("[chat] new context after navigation (%d chars)", newContext.length);

                    // Send follow-up with new context for the AI to answer from
                    const followupBody = JSON.stringify({
                        message: "[Context update after navigation — answer the user's original question using this new page context. Use page_action scrollTo to highlight the most relevant element.]",
                        context: newContext || undefined,
                    });
                    const followup = await processStream(`${AGENT_URL}/prompt/stream`, followupBody);

                    const finalText = followup.response && followup.response !== "(no response)"
                        ? followup.response
                        : response || "Done — I've opened the page.";

                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        content: finalText,
                        timestamp: new Date()
                    }]);

                    if (followup.workerTaskId) {
                        setWorkerTaskId(followup.workerTaskId);
                    }
                    if (followup.action) {
                        setTimeout(() => executeAction(followup.action!), 100);
                    }
                } else {
                    // Bad navigate target — show the original response
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        content: response,
                        timestamp: new Date()
                    }]);
                }
            } else {
                // Non-navigate response — show normally
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: response,
                    timestamp: new Date()
                }]);

                if (wid) {
                    setWorkerTaskId(wid);
                }

                // Execute page action after message is rendered
                if (action) {
                    setTimeout(() => executeAction(action), 100);
                }
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: `Sorry, I couldn't reach the agent. ${err instanceof Error ? err.message : "Please check the connection."}`,
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
            loadingRef.current = false;
            setStatusText("");
            setStreamingText("");

            // Process queued message if any
            const queued = queuedMessage.current;
            if (queued) {
                queuedMessage.current = null;
                sendOne(queued);
            }
        }
    };

    const handleSend = (text: string) => {
        if (!text.trim()) return;
        setInputValue("");

        if (loadingRef.current) {
            // Queue message — show it in chat immediately, send after current response
            queuedMessage.current = text;
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: "user",
                content: text,
                timestamp: new Date()
            }]);
        } else {
            sendOne(text);
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100]">
            <AnimatePresence>
                {isOpen && (
                    <div
                        className="absolute bottom-20 right-0"
                        style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
                    >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-[calc(100vw-32px)] sm:w-[400px] h-[600px] max-h-[70vh] bg-white rounded-[32px] shadow-2xl border border-[#0F1016]/5 flex flex-col overflow-hidden"
                    >
                        {/* Header — draggable */}
                        <div
                            className="p-6 bg-[#0F1016] text-white flex justify-between items-center cursor-grab active:cursor-grabbing select-none"
                            onMouseDown={(e) => {
                                // Don't start drag if clicking a button
                                if ((e.target as HTMLElement).closest("button")) return;
                                dragging.current = true;
                                dragStart.current = { x: e.clientX, y: e.clientY, ox: dragOffset.x, oy: dragOffset.y };
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#0000EE] flex items-center justify-center text-white">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-sans font-bold text-[16px]">Lette Assistant</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${loading || workerTaskId ? "bg-amber-400" : "bg-emerald-400"} animate-pulse`} />
                                        <span className="text-[11px] text-white/60 uppercase tracking-widest font-bold">
                                            {loading ? (statusText || "Typing...") : workerTaskId ? "Searching CRM..." : "Online"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                            <button
                                onClick={handleNewChat}
                                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                                title="Start new chat"
                            >
                                New Chat
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    data-msg-id={msg.id}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div className={`max-w-[85%] rounded-[24px] p-4 ${msg.role === "user"
                                        ? "bg-[#0000EE] text-white rounded-tr-none"
                                        : "bg-slate-50 border border-slate-100 text-[#0F1016] rounded-tl-none"
                                        }`}>
                                        <div className={`text-[14px] leading-relaxed ${msg.role === "assistant" ? "font-serif chat-markdown" : "font-sans font-medium whitespace-pre-line"}`}>
                                            {msg.role === "assistant"
                                                ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                : msg.content}
                                        </div>
                                        <span className={`text-[10px] block mt-1 opacity-50 ${msg.role === "user" ? "text-right" : ""}`}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {/* Live streaming response — shows text as it arrives */}
                            {loading && streamingText && (
                                <div className="flex justify-start">
                                    <div className="max-w-[85%] rounded-[24px] p-4 bg-slate-50 border border-slate-100 text-[#0F1016] rounded-tl-none">
                                        <div className="text-[14px] leading-relaxed font-serif chat-markdown">
                                            <ReactMarkdown>{streamingText}</ReactMarkdown>
                                        </div>
                                        {statusText && (
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                                                <Loader2 className="w-3 h-3 text-[#0000EE] animate-spin" />
                                                <span className="text-[10px] text-[#0F1016]/40 font-sans">{statusText}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* Loading indicator when no text has arrived yet */}
                            {loading && !streamingText && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-50 border border-slate-100 rounded-[24px] rounded-tl-none p-4 flex items-center gap-2">
                                        <Loader2 className="w-5 h-5 text-[#0000EE] animate-spin shrink-0" />
                                        {statusText && <span className="text-xs text-[#0F1016]/50 font-sans">{statusText}</span>}
                                    </div>
                                </div>
                            )}
                            {/* Worker running in background — user can still chat */}
                            {workerTaskId && !loading && (
                                <div className="flex justify-start" data-testid="worker-indicator">
                                    <div className="bg-slate-50 border border-slate-100 rounded-full px-4 py-2 flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 text-[#0000EE] animate-spin shrink-0" />
                                        <span className="text-[11px] text-[#0F1016]/40 font-sans font-medium">Searching CRM...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Suggestions */}
                        {messages.length < 3 && !loading && (
                            <div className="px-6 pb-2 overflow-x-auto">
                                <div className="flex flex-nowrap sm:flex-wrap gap-2 pb-2">
                                    {SUGGESTED_PROMPTS.map((prompt) => (
                                        <button
                                            key={prompt}
                                            onClick={() => handleSend(prompt)}
                                            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-[12px] font-sans font-medium text-slate-600 transition-all flex items-center group shadow-sm whitespace-nowrap"
                                        >
                                            {prompt}
                                            <ChevronRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-6 pt-2 border-t border-slate-100 bg-white">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
                                className="relative"
                            >
                                <textarea
                                    value={inputValue}
                                    onChange={(e) => {
                                        setInputValue(e.target.value);
                                        e.target.style.height = "auto";
                                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend(inputValue);
                                        }
                                    }}
                                    placeholder="Ask anything about your tasks..."
                                    rows={1}
                                    className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-[20px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0000EE]/20 focus:border-[#0000EE] transition-all placeholder:text-slate-400 font-sans resize-none overflow-y-auto scrollbar-hide"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim()}
                                    className="absolute right-2 bottom-2 w-10 h-10 bg-[#0000EE] text-white rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#0000CC] transition-all"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl border border-slate-200 transition-all duration-300 ${isOpen
                        ? "bg-white rotate-90 scale-90"
                        : "bg-[#F8F8F6] hover:bg-white hover:scale-110 hover:shadow-2xl"
                    }`}
            >
                {isOpen ? (
                    <X className="w-6 h-6 text-[#0F1016]" />
                ) : (
                    <div className="relative">
                        <MessageSquare className="w-8 h-8 text-[#0F1016] fill-[#0F1016]/5" />
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#0000EE] rounded-full border-4 border-[#F8F8F6] z-10" />
                    </div>
                )}
            </button>
        </div>
    );
}
