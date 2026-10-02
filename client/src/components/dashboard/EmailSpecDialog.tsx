import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, History, Mail, Paperclip, Send, Trash2, Upload, Users, X } from "lucide-react";
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
import { fileToEmailAttachment, type UserEmailAttachment } from "@/lib/exportEmailAttachment";

type SpecsAttachment = { filename: string; base64: string };
type AdditionalAttachment = UserEmailAttachment & { size: number };

const MAX_ADDITIONAL_ATTACHMENTS = 10;
const MAX_ADDITIONAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_SINGLE_ADDITIONAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type RecipientGroup = {
  id: number;
  name: string;
  recipients: string[];
  cc: string[];
  replyTo: string | null;
};

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

function joinRecipients(recipients: string[] | undefined): string {
  return (recipients ?? []).join("; ");
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const utils = trpc.useUtils();
  const [recipientText, setRecipientText] = useState("");
  const [ccText, setCcText] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("manual");
  const [isPreparing, setIsPreparing] = useState(false);
  const [additionalAttachments, setAdditionalAttachments] = useState<AdditionalAttachment[]>([]);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recipientGroups = trpc.email.listRecipientGroups.useQuery(undefined, { enabled: open });
  const emailHistory = trpc.email.getSpecsHistory.useQuery({ style, season }, { enabled: open });
  const sendSpecsEmail = trpc.email.sendSpecs.useMutation();
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
    if (open) {
      setSubject(defaultSubject);
      setAdditionalAttachments([]);
      setIsFileDragActive(false);
    }
  }, [defaultSubject, open]);

  const addAdditionalAttachments = async (files: FileList | File[]) => {
    const filesToAdd = Array.from(files);
    if (filesToAdd.length === 0) return;

    const attachmentSlots = MAX_ADDITIONAL_ATTACHMENTS - additionalAttachments.length;
    if (attachmentSlots <= 0) {
      toast.error(`You can add up to ${MAX_ADDITIONAL_ATTACHMENTS} extra attachments.`);
      return;
    }
    const permittedFiles = filesToAdd.slice(0, attachmentSlots);
    if (filesToAdd.length > attachmentSlots) {
      toast.error(`Only the first ${attachmentSlots} file${attachmentSlots === 1 ? "" : "s"} could be added.`);
    }
    const oversizedFile = permittedFiles.find((file) => file.size > MAX_SINGLE_ADDITIONAL_ATTACHMENT_BYTES);
    if (oversizedFile) {
      toast.error(`${oversizedFile.name} is over the 10 MB per-file limit.`);
      return;
    }
    const newBytes = permittedFiles.reduce((total, file) => total + file.size, 0);
    const existingBytes = additionalAttachments.reduce((total, attachment) => total + attachment.size, 0);
    if (existingBytes + newBytes > MAX_ADDITIONAL_ATTACHMENT_BYTES) {
      toast.error("Extra attachments are limited to 20 MB in total.");
      return;
    }

    try {
      const prepared = await Promise.all(permittedFiles.map(async (file) => ({
        ...(await fileToEmailAttachment(file)),
        size: file.size,
      })));
      setAdditionalAttachments((current) => [...current, ...prepared]);
    } catch {
      toast.error("One of the attachments could not be prepared.");
    }
  };

  const removeAdditionalAttachment = (index: number) => {
    setAdditionalAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

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
    if (!groupName.trim()) {
      toast.error("Name the recipient group before saving it");
      return;
    }
    if (recipients.length === 0) {
      toast.error("Add at least one recipient before saving the group");
      return;
    }
    if (normalizedReplyTo && !isEmailAddress(normalizedReplyTo)) {
      toast.error("Enter a valid reply-to email address");
      return;
    }
    await saveRecipientGroup.mutateAsync({
      name: groupName.trim(),
      recipients,
      cc: cc.length ? cc : undefined,
      replyTo: normalizedReplyTo || undefined,
    });
  };

  const send = async () => {
    const recipients = parseRecipients(recipientText);
    const cc = parseRecipients(ccText);
    const normalizedReplyTo = replyTo.trim().toLowerCase();
    if (recipients.length === 0) {
      toast.error("Enter at least one recipient email address");
      return;
    }
    if (normalizedReplyTo && !isEmailAddress(normalizedReplyTo)) {
      toast.error("Enter a valid reply-to email address");
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
        cc: cc.length ? cc : undefined,
        replyTo: normalizedReplyTo || undefined,
        subject: subject.trim(),
        message: message.trim() || undefined,
        style,
        last,
        category,
        season,
        attachment,
        additionalAttachments: additionalAttachments.map(({ filename, base64, contentType }) => ({ filename, base64, contentType })),
      });
      await utils.email.getSpecsHistory.invalidate({ style, season });
      const attachmentSummary = additionalAttachments.length
        ? ` with ${additionalAttachments.length} extra attachment${additionalAttachments.length === 1 ? "" : "s"}`
        : "";
      toast.success(`Sent ${attachment.filename}${attachmentSummary} to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`);
      setMessage("");
      setAdditionalAttachments([]);
      onOpenChange(false);
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The Specs email could not be sent");
    } finally {
      setIsPreparing(false);
    }
  };

  const selectedGroup = selectedGroupId === "manual"
    ? undefined
    : (recipientGroups.data as RecipientGroup[] | undefined)?.find((entry) => String(entry.id) === selectedGroupId);
  const isSending = isPreparing || sendSpecsEmail.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email Specs sheet</DialogTitle>
          <DialogDescription>
            Sends the Excel specification sheet for {style.toUpperCase()} as an attachment.
          </DialogDescription>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => deleteRecipientGroup.mutate({ id: selectedGroup.id })}
                  disabled={deleteRecipientGroup.isPending}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Choosing a group fills To, CC, and reply-to. You can still adjust the details for this email.</p>
          </section>

          <div className="space-y-2">
            <Label htmlFor="spec-email-recipients">To</Label>
            <Input
              id="spec-email-recipients"
              type="text"
              value={recipientText}
              onChange={(event) => { setRecipientText(event.target.value); setSelectedGroupId("manual"); }}
              placeholder="factory@example.com; developer@example.com"
            />
            <p className="text-xs text-muted-foreground">Use commas, semicolons, or new lines to add multiple recipients.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spec-email-cc">CC (optional)</Label>
            <Input
              id="spec-email-cc"
              type="text"
              value={ccText}
              onChange={(event) => { setCcText(event.target.value); setSelectedGroupId("manual"); }}
              placeholder="merchandising@example.com; product@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spec-email-reply-to">Reply-to (optional)</Label>
            <Input
              id="spec-email-reply-to"
              type="email"
              value={replyTo}
              onChange={(event) => { setReplyTo(event.target.value); setSelectedGroupId("manual"); }}
              placeholder="product@tonybianco.info"
            />
          </div>

          <section className="space-y-2 rounded-lg border border-dashed p-3">
            <Label htmlFor="spec-email-group-name">Save these recipients as a group</Label>
            <div className="flex gap-2">
              <Input
                id="spec-email-group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="e.g. Vietnam factory & developer"
              />
              <Button type="button" variant="outline" className="shrink-0" onClick={saveGroup} disabled={saveRecipientGroup.isPending || !groupName.trim()}>
                <BookmarkPlus className="mr-1.5 h-4 w-4" /> Save group
              </Button>
            </div>
          </section>

          <div className="space-y-2">
            <Label htmlFor="spec-email-subject">Subject</Label>
            <Input id="spec-email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spec-email-message">Message (optional)</Label>
            <Textarea id="spec-email-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Add any notes for the recipient…" />
          </div>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium"><Paperclip className="h-4 w-4" /> Extra attachments (optional)</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) void addAdditionalAttachments(event.target.files);
                event.target.value = "";
              }}
            />
            <div
              className={`rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${isFileDragActive ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-muted-foreground/25 bg-muted/20"}`}
              onDragEnter={(event) => { event.preventDefault(); setIsFileDragActive(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); setIsFileDragActive(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setIsFileDragActive(false);
                void addAdditionalAttachments(event.dataTransfer.files);
              }}
            >
              <Upload className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Drag and drop files here</p>
              <p className="mt-1 text-xs text-muted-foreground">or select files from your computer — up to 10 files, 10 MB each, 20 MB total.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="mr-1.5 h-4 w-4" /> Choose files
              </Button>
            </div>
            {additionalAttachments.length > 0 && (
              <div className="space-y-1.5">
                {additionalAttachments.map((attachment, index) => (
                  <div key={`${attachment.filename}-${index}`} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{attachment.filename}</span>
                    <span className="shrink-0 text-muted-foreground">{formatFileSize(attachment.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeAdditionalAttachment(index)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`Remove ${attachment.filename}`}
                      title={`Remove ${attachment.filename}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Files are used for this email only and are not saved in SKU Dash.</p>
          </section>

          <section className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4" /> Email history for {style.toUpperCase()}</div>
            {emailHistory.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading previous deliveries…</p>
            ) : emailHistory.data?.length ? (
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {emailHistory.data.map((entry) => (
                  <div key={entry.id} className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-medium">
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      <span>{entry.sentByName || "SKU Dash"}</span>
                    </div>
                    <p className="mt-1 break-words text-muted-foreground">To: {entry.recipients.join(", ")}{entry.cc.length ? ` · CC: ${entry.cc.join(", ")}` : ""}</p>
                    <p className="mt-1 truncate text-muted-foreground">{entry.subject}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No Specs emails have been sent for this style in {season} yet.</p>
            )}
          </section>
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
