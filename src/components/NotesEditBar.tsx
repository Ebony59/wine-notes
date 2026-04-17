import { Button } from "@/components/ui/button";

interface NotesEditBarProps {
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function NotesEditBar({ saving, onSave, onCancel, onDelete }: NotesEditBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button variant="secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      {onDelete && (
        <Button variant="danger" onClick={onDelete} disabled={saving} className="ml-auto">
          Delete
        </Button>
      )}
    </div>
  );
}
