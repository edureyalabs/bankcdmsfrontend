const BADGE: Record<string, { bg: string; color: string; border: string }> = {
  "Full Match":    { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  "Partial Match": { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  "Unmatched":     { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  "Excluded":      { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = BADGE[status] ?? BADGE["Excluded"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: s.bg, color: s.color,
      border: `1.5px solid ${s.border}`,
      fontSize: "11px", fontWeight: 700,
      padding: "2px 9px", borderRadius: "99px",
    }}>
      {status}
    </span>
  );
}