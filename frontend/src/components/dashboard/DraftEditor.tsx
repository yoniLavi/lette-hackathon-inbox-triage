"use client"

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { updateEmail, deleteEmail } from "@/lib/crm";
import type { CrmEmail } from "@/lib/crm";
import { unescapeMarkdown } from "@/lib/unescape-markdown";

function useAutoResize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    }, [ref, value]);
}

export function DraftEditor({ email, onUpdate, onDiscard, className }: {
    email: CrmEmail;
    onUpdate: (e: CrmEmail) => void;
    onDiscard?: () => void;
    className?: string;
}) {
    const plainBody = unescapeMarkdown(email.body_plain || email.body?.replace(/<[^>]*>/g, '') || "");
    const [body, setBody] = useState(plainBody);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [discarding, setDiscarding] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useAutoResize(textareaRef, body);

    // Reset when email changes
    useEffect(() => {
        const newBody = unescapeMarkdown(email.body_plain || email.body?.replace(/<[^>]*>/g, '') || "");
        setBody(newBody);
        setDirty(false);
    }, [email.id]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setBody(e.target.value);
        setDirty(true);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateEmail(email.id, { body, body_plain: body });
            onUpdate({ ...email, body, body_plain: body });
            setDirty(false);
        } catch (e) {
            console.error("Failed to save draft:", e);
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        if (!confirm("Discard this draft? This cannot be undone.")) return;
        setDiscarding(true);
        try {
            await deleteEmail(email.id);
            onDiscard?.();
        } catch (e) {
            console.error("Failed to discard draft:", e);
        } finally {
            setDiscarding(false);
        }
    };

    return (
        <div className={className}>
            <textarea
                ref={textareaRef}
                value={body}
                onChange={handleChange}
                className="w-full px-5 py-4 bg-white/50 font-sans text-sm text-[#0F1016] leading-relaxed resize-none outline-none overflow-hidden"
                rows={1}
            />
            <div className="px-5 py-2.5 bg-[#0F1016]/5 border-t border-[#0F1016]/5 flex justify-between items-center">
                <Button variant="ghost" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDiscard} disabled={discarding}>
                    <Trash2 className="w-3 h-3 mr-1" /> {discarding ? "..." : "Discard"}
                </Button>
                <div className="flex gap-2">
                    <div className="relative group">
                        <Button variant="secondary" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-wider opacity-40 cursor-not-allowed" disabled>
                            <Send className="w-3 h-3 mr-1" /> Send
                        </Button>
                        <div className="absolute bottom-full right-0 mb-1.5 px-2.5 py-1.5 bg-[#0F1016] text-white text-[10px] font-sans rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            No SMTP connection configured
                        </div>
                    </div>
                    <Button size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-wider" onClick={handleSave} disabled={saving || !dirty}>
                        <Check className="w-3 h-3 mr-1" /> {saving ? "Saving..." : "Save Draft"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
