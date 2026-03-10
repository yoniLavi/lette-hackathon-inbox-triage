"use client"

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X, Send, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

const WELCOME_MSG: Message = {
    id: "1",
    role: "assistant",
    content: "Hi! I'm your Lette AI assistant. I have access to the CRM — ask me about emails, contacts, or cases.",
    timestamp: new Date(),
};

const SUGGESTED_PROMPTS = [
    "Summarize high-priority maintenance",
    "Show me issues for Graylings",
    "What's the status of the leak case?",
    "Draft a response to the tenant"
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

function usePageContext(): string {
    const pathname = usePathname();
    if (pathname === "/") return "User is on the main dashboard, which shows a work queue of cases needing attention (with action status badges like 'Draft ready', 'Needs triage', 'N actions pending'), priority queues (Critical/High cases), and work-centric stats (Pending Tasks, Drafts to Review, Resolved).";
    if (pathname.startsWith("/situations/")) {
        const id = pathname.split("/").pop();
        return `User is viewing case/situation detail page (case ID: ${id}). They can see the AI summary, recommended actions (tasks), draft responses for review, communications grouped by thread with contact names and type badges, related contacts grouped by type, agent notes, and property context.`;
    }
    if (pathname === "/properties") return "User is on the Properties page, which lists properties with case and contact counts.";
    if (pathname === "/search") return "User is on the Search page, which searches emails via full-text search with contact resolution.";
    return `User is on page: ${pathname}`;
}

export function AIAssistant() {
    const pageContext = usePageContext();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>(loadMessages);
    const [inputValue, setInputValue] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        saveMessages(messages);
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const [statusText, setStatusText] = useState("");

    const friendlyTool = (name: string) => {
        if (name.includes("crm") || name.includes("Bash")) {
            const action = name.split("__").pop() || name;
            return `CRM: ${action.replace(/_/g, " ")}`;
        }
        return name.replace(/_/g, " ");
    };

    const processStream = async (url: string, body: string): Promise<string> => {
        console.log("[chat] fetch processStream called, url:", url);
        setStatusText("Connecting...");

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

        console.log("[chat] starting stream read loop");

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log("[chat] stream done");
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            console.log("[chat] chunk received, length:", chunk.length);
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
                            setStatusText(data.status === "connecting" ? "Connecting..." : "Thinking...");
                        } else if (currentEvent === "tool_use") {
                            setStatusText(friendlyTool(data.tool));
                        } else if (currentEvent === "progress") {
                            setStatusText(data.text || "Working...");
                        } else if (currentEvent === "text") {
                            finalResponse = data.text;
                            setStatusText("Writing...");
                        } else if (currentEvent === "done") {
                            finalResponse = data.response;
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

        return finalResponse || "(no response)";
    };

    const handleNewChat = async () => {
        setMessages([WELCOME_MSG]);
        setLoading(false);
        setStatusText("");
        try {
            await fetch(`${AGENT_URL}/session/restart`, { method: "POST" });
        } catch { /* ignore */ }
    };

    const handleSend = async (text: string) => {
        if (!text.trim() || loading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: text,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue("");
        setLoading(true);
        setStatusText("Connecting...");

        try {
            const body = JSON.stringify({ message: text, context: pageContext });
            const response = await processStream(`${AGENT_URL}/prompt/stream`, body);

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: response,
                timestamp: new Date()
            }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: `Sorry, I couldn't reach the agent. ${err instanceof Error ? err.message : "Please check the connection."}`,
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
            setStatusText("");
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100]">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="absolute bottom-20 right-0 w-[calc(100vw-32px)] sm:w-[400px] h-[600px] max-h-[70vh] bg-white rounded-[32px] shadow-2xl border border-[#0F1016]/5 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 bg-[#0F1016] text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#0000EE] flex items-center justify-center text-white">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-sans font-bold text-[16px]">Lette Assistant</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-amber-400" : "bg-emerald-400"} animate-pulse`} />
                                        <span className="text-[11px] text-white/60 uppercase tracking-widest font-bold">
                                            {loading ? (statusText || "Thinking...") : "Online"}
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
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div className={`max-w-[85%] rounded-[24px] p-4 ${msg.role === "user"
                                        ? "bg-[#0000EE] text-white rounded-tr-none"
                                        : "bg-slate-50 border border-slate-100 text-[#0F1016] rounded-tl-none"
                                        }`}>
                                        <div className={`text-[14px] leading-relaxed ${msg.role === "assistant" ? "font-serif" : "font-sans font-medium whitespace-pre-line"}`}>
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
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-50 border border-slate-100 rounded-[24px] rounded-tl-none p-4 flex items-center gap-2">
                                        <Loader2 className="w-5 h-5 text-[#0000EE] animate-spin shrink-0" />
                                        {statusText && <span className="text-xs text-[#0F1016]/50 font-sans">{statusText}</span>}
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
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={loading ? "Waiting for response..." : "Ask anything about your tasks..."}
                                    disabled={loading}
                                    className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0000EE]/20 focus:border-[#0000EE] transition-all placeholder:text-slate-400 font-sans disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || loading}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#0000EE] text-white rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#0000CC] transition-all"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    </motion.div>
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
