import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

/** Read-only recognition shortcut; expanding never changes an approval or photo. */
export function LastApprovalStyleThumbnail({
  styleName,
  imageUrl,
  lastName,
  onExpand,
}: {
  styleName: string;
  imageUrl?: string;
  lastName: string;
  onExpand: () => void;
}) {
  // A replaced URL can render immediately, even after the previous image failed.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasImage = !!imageUrl && failedUrl !== imageUrl;

  return (
    <button
      type="button"
      data-last-style-thumbnail={styleName}
      onClick={onExpand}
      title={`Show styles on ${lastName} — ${styleName}`}
      aria-label={`Show ${styleName} on ${lastName}`}
      className="group flex w-20 flex-col items-center gap-1 rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="flex h-16 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-white transition-colors group-hover:border-foreground/30">
        {hasImage ? (
          <img
            src={imageUrl}
            alt={`${styleName} style`}
            width={80}
            height={64}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-1"
            onError={() => setFailedUrl(imageUrl!)}
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px]">No image</span>
          </span>
        )}
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium leading-4">{styleName}</span>
    </button>
  );
}
