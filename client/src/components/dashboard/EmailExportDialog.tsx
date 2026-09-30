import { useEffect, useState } from "react";
import { BookmarkPlus, History, Mail, Send, Trash2, Users } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ExportAttachment = { filename: string; base64: string };
type RecipientGroup = { id: number; name: string; recipients: string[]; cc: string[]; replyTo: string | null };

function parseRecipients(value: string): string[] {
  return Array.from(new Set(value.split(/[;,\n]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean)));
}

function joinRecipients(recipients: string[] | undefined): string {
  return (recipients ?? []).join("; ");
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function EmailExportDialog({
  open,
  onOpenChange,
  exportType,
  exportScope,
  season,
  defaultSubject,
  buildAttachment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportType: string;
  exportScope: string;
  season: string;
  defaultSubject: string;
  buildAttachment: () => Promise<ExportAttachment>;
}) {
  const utils = trpc.useUtils();
  const [recipientText, setRecipientText] = useState("");
  const [ccText, setCcText] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("manual");
  const [isPreparing, setIsPreparing] = useState(false);

  const recipientGroups = trpc.email.listRecipientGroups.useQuery(undefined, { enabled: open });
  const emailHistory = trpc.email.getExportHistory.useQuery({ exportType, exportScope, season }, { enabled: open });
  const sendExport = trpc.email.sendExport.useMutation();
  const saveRecipientGroup = trpc.email.saveRecipientGroup.useMutation({
    onSuccess: async (result) => {
      await utils.email.listRecipientGroups.invalidate();
      if (result.group) setSelectedGroupId(String(result.group.id));
      setGroupName("");
      toast.success("Recipient group saved");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteRecipientGroup = trpc.email.deleteRecipientGroup.useMutation({
    onSuccess: async () => {
      await utils.email.listRecipientGroups.invalidate();
      setSelectedGroupId("manual");
      toast.success("Recipient group removed");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (open) setSubject(defaultSubject);
  }, [defaultSubject, open]);

  const applyRecipientGroup = (id: string) => {
    setSelectedGroupId(id);
    if (id === "manual") return;
    const group = (recipientGroups.data as RecipientGroup[] | undefined)?.find((entry) => String(entry.id) === id);
    if (!group) return;
    setRecipientText(joinRecipients(group.recipients));
    setCcText(joinRecipients(group.cc));
    setReplyTo(group.replyTo ?? "");
  };

  const saveGroup = async () => {
    const recipients = parseRecipients(recipientText);
    const cc = parseRecipients(ccText);
    const normalizedReplyTo = replyTo.trim().toLowerCase();
    if (!groupName.trim()) return toast.error("Name the recipient group before saving it");
    if (recipients.length === 0) return toast.error("Add at least one recipient before saving the group");
    if (normalizedReplyTo && !isEmailAddress(normalizedReplyTo)) return toast.error("Enter a valid reply-to email address");
    await saveRecipientGroup.mutateAsync({
      name: groupName.trim(), recipients, cc: cc.length ? cc : undefined, replyTo: normalizedReplyTo || undefined,
    });
  };

  const send = async () => {
    const recipients = parseRecipients(recipientText);
    const cc = parseRecipients(ccText);
    const normalizedReplyTo = replyTo.trim().toLowerCase();
    if (recipients.length === 0) return toast.error("Enter at least one recipient email address");
    if (normalizedReplyTo && !isEmailAddress(normalizedReplyTo)) return toast.error("Enter a valid reply-to email address");
    if (!subject.trim()) return toast.error("Enter an email subject");
    setIsPreparing(true);
    try {
      const attachment = await buildAttachment();
      await sendExport.mutateAsync({
        recipients,
        cc: cc.length ? cc : undefined,
        replyTo: normalizedReplyTo || undefined,
        subject: subject.trim(),
        message: message.trim() || undefined,
        exportType,
        exportScope,
        season,
        attachment,
      });
      await utils.email.getExportHistory.invalidate({ exportType, exportScope, season });
      toast.success(`Sent ${attachment.filename} to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`);
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The export email could not be sent");
    } finally {
      setIsPreparing(false);
    }
  };

  const selectedGroup = selectedGroupId === "manual"
    ? undefined
    : (recipientGroups.data as RecipientGroup[] | undefined)?.find((entry) => String(entry.id) === selectedGroupId);
  const isSending = isPreparing || sendExport.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email {exportType}</DialogTitle>
          <DialogDescription>Sends the current {exportType.toLowerCase()} for {exportScope} as an attachment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" /> Saved recipient groups</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedGroupId} onValueChange={applyRecipientGroup}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a saved group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual recipients</SelectItem>
                  {(recipientGroups.data as RecipientGroup[] | undefined)?.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedGroup && (
                <Button type="button" variant="outline" size="sm" className="shrink-0 text-destructive hover:text-destructive" onClick={() => deleteRecipientGroup.mutate({ id: selectedGroup.id })} disabled={deleteRecipientGroup.isPending}>
                  <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Choosing a group fills To, CC, and reply-to. You can still adjust the details for this email.</p>
          </section>
          <div className="space-y-2"><Label htmlFor="export-email-recipients">To</Label><Input id="export-email-recipients" value={recipientText} onChange={(event) => { setRecipientText(event.target.value); setSelectedGroupId("manual"); }} placeholder="factory@example.com; developer@example.com" /><p className="text-xs text-muted-foreground">Use commas, semicolons, or new lines for multiple recipients.</p></div>
          <div className="space-y-2"><Label htmlFor="export-email-cc">CC (optional)</Label><Input id="export-email-cc" value={ccText} onChange={(event) => { setCcText(event.target.value); setSelectedGroupId("manual"); }} placeholder="merchandising@example.com; product@example.com" /></div>
          <div className="space-y-2"><Label htmlFor="export-email-reply-to">Reply-to (optional)</Label><Input id="export-email-reply-to" type="email" value={replyTo} onChange={(event) => { setReplyTo(event.target.value); setSelectedGroupId("manual"); }} placeholder="product@tonybianco.info" /></div>
          <section className="space-y-2 rounded-lg border border-dashed p-3"><Label htmlFor="export-email-group-name">Save these recipients as a group</Label><div className="flex gap-2"><Input id="export-email-group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Vietnam factory & developer" /><Button type="button" variant="outline" className="shrink-0" onClick={saveGroup} disabled={saveRecipientGroup.isPending || !groupName.trim()}><BookmarkPlus className="mr-1.5 h-4 w-4" /> Save group</Button></div></section>
          <div className="space-y-2"><Label htmlFor="export-email-subject">Subject</Label><Input id="export-email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="export-email-message">Message (optional)</Label><Textarea id="export-email-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Add any notes for the recipient…" /></div>
          <section className="space-y-2 border-t pt-4"><div className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4" /> Email history for {exportScope}</div>{emailHistory.isLoading ? <p className="text-sm text-muted-foreground">Loading previous deliveries…</p> : emailHistory.data?.length ? <div className="max-h-40 space-y-2 overflow-y-auto pr-1">{emailHistory.data.map((entry) => <div key={entry.id} className="rounded-md border bg-muted/20 px-3 py-2 text-xs"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-medium"><span>{new Date(entry.createdAt).toLocaleString()}</span><span>{entry.sentByName || "SKU Dash"}</span></div><p className="mt-1 break-words text-muted-foreground">To: {entry.recipients.join(", ")}{entry.cc.length ? ` · CC: ${entry.cc.join(", ")}` : ""}</p><p className="mt-1 truncate text-muted-foreground">{entry.subject}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No {exportType.toLowerCase()} emails have been sent for this scope in {season} yet.</p>}</section>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button><Button onClick={send} disabled={isSending || !recipientText.trim()} className="gap-2"><Send className="h-4 w-4" />{isPreparing ? "Preparing attachment…" : sendExport.isPending ? "Sending…" : "Send email"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
