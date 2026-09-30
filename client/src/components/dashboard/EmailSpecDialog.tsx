import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SpecsAttachment = { filename: string; base64: string };

function parseRecipients(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[;,\n]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function EmailSpecDialog({
  open,
  onOpenChange,
  style,
  last,
  category,
  season,
  defaultSubject,
  buildAttachment,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style: string;
  last: string;
  category: string;
  season: string;
  defaultSubject: string;
  buildAttachment: () => Promise<SpecsAttachment>;
  onSent?: () => void;
}) {
  const [recipientText, setRecipientText] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const sendSpecsEmail = trpc.email.sendSpecs.useMutation();

  useEffect(() => {
    if (open) setSubject(defaultSubject);
  }, [defaultSubject, open]);

  const send = async () => {
    const recipients = parseRecipients(recipientText);
    if (recipients.length === 0) {
      toast.error("Enter at least one recipient email address");
      return;
    }
    if (!subject.trim()) {
      toast.error("Enter an email subject");
      return;
    }

    setIsPreparing(true);
    try {
      const attachment = await buildAttachment();
      await sendSpecsEmail.mutateAsync({
        recipients,
        subject: subject.trim(),
        message: message.trim() || undefined,
        style,
        last,
        category,
        season,
        attachment,
      });
      toast.success(`Sent ${attachment.filename} to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`);
      setMessage("");
      onOpenChange(false);
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The Specs email could not be sent");
    } finally {
      setIsPreparing(false);
    }
  };

  const isSending = isPreparing || sendSpecsEmail.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email Specs sheet</DialogTitle>
          <DialogDescription>
            Sends the Excel specification sheet for {style.toUpperCase()} as an attachment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="spec-email-recipients">Recipients</Label>
            <Input
              id="spec-email-recipients"
              type="text"
              value={recipientText}
              onChange={(event) => setRecipientText(event.target.value)}
              placeholder="factory@example.com; developer@example.com"
            />
            <p className="text-xs text-muted-foreground">Use commas, semicolons, or new lines to add multiple recipients.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spec-email-subject">Subject</Label>
            <Input id="spec-email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spec-email-message">Message (optional)</Label>
            <Textarea id="spec-email-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Add any notes for the recipient…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button>
          <Button onClick={send} disabled={isSending || !recipientText.trim()} className="gap-2">
            <Send className="h-4 w-4" />
            {isPreparing ? "Preparing attachment…" : sendSpecsEmail.isPending ? "Sending…" : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
