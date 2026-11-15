import { getFittingSizeOptions } from "@shared/lastApprovalSizes";

export function FittingSizeSelect({
  season,
  value,
  onChange,
}: {
  season: string;
  value: string;
  onChange: (size: string) => void;
}) {
  return (
    <select
      aria-label="Fitting size"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border border-border rounded px-2 py-0.5 text-xs bg-background min-w-16"
    >
      {getFittingSizeOptions(season, value).map((size) => (
        <option key={size} value={size}>{size}</option>
      ))}
    </select>
  );
}
