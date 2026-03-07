"use client"

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

const SUGGESTED_PROMPTS = [
    "Summarize high-priority maintenance",
    "Show me issues for Graylings",
    "What's the status of the leak case?",
    "Draft a response to the tenant"
];

export function AIAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Hi Maria! I'm your Lette AI assistant. How can I help you manage your properties today?",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSend = (text: string) => {
        if (!text.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: text,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue("");

        // Simulate AI response
        setTimeout(() => {
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: `I've analyzed the situations and ${text.toLowerCase().includes('summary') ? 'here is a breakdown of your current workload: You have 8 urgent cases across 3 properties.' : "I'm looking into that for you. Based on the recent emails, there's a follow-up required for Graylings regarding the contractor schedule."}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        }, 1000);
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
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-[11px] text-white/60 uppercase tracking-widest font-bold">Online</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
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
                                        <p className={`text-[14px] leading-relaxed ${msg.role === "assistant" ? "font-serif" : "font-sans font-medium"}`}>
                                            {msg.content}
                                        </p>
                                        <span className={`text-[10px] block mt-1 opacity-50 ${msg.role === "user" ? "text-right" : ""}`}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Suggestions */}
                        {messages.length < 3 && (
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
                                    placeholder="Ask anything about your tasks..."
                                    className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0000EE]/20 focus:border-[#0000EE] transition-all placeholder:text-slate-400 font-sans"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim()}
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
