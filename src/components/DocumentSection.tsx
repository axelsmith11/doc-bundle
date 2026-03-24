import { useRef, useState } from "react";
import { X, GripVertical, RotateCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FileUploadZone from "./FileUploadZone";

export interface DocFile {
  id: string;
  file: File;
  preview?: string;
  rotation: number;
}

interface DocumentSectionProps {
  title: string;
  category: string;
  files: DocFile[];
  onAddFiles: (category: string, files: File[]) => void;
  onRemoveFile: (category: string, fileId: string) => void;
  onRotateFile: (category: string, fileId: string) => void;
  onReorder: (category: string, files: DocFile[]) => void;
}

export default function DocumentSection({
  title,
  category,
  files,
  onAddFiles,
  onRemoveFile,
  onRotateFile,
  onReorder,
}: DocumentSectionProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const touchStartRef = useRef<{ id: string; startY: number; startX: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const confirmDelete = () => {
    if (deleteTarget) {
      onRemoveFile(category, deleteTarget);
      setDeleteTarget(null);
    }
  };

  // Desktop drag
  const handleDragStart = (id: string) => setDragging(id);

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;

    const newFiles = [...files];
    const fromIdx = newFiles.findIndex((f) => f.id === dragging);
    const toIdx = newFiles.findIndex((f) => f.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = newFiles.splice(fromIdx, 1);
    newFiles.splice(toIdx, 0, moved);
    onReorder(category, newFiles);
  };

  const handleDragEnd = () => setDragging(null);

  // Touch drag (mobile)
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    const touch = e.touches[0];
    touchStartRef.current = { id, startY: touch.clientY, startX: touch.clientX };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !containerRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.startX);
    const dy = Math.abs(touch.clientY - touchStartRef.current.startY);

    // Only reorder if moved enough
    if (dx < 20 && dy < 20) return;

    // Find element under touch
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;

    const card = el.closest("[data-file-id]") as HTMLElement | null;
    if (!card) return;

    const targetId = card.dataset.fileId;
    if (!targetId || targetId === touchStartRef.current.id) return;

    const newFiles = [...files];
    const fromIdx = newFiles.findIndex((f) => f.id === touchStartRef.current!.id);
    const toIdx = newFiles.findIndex((f) => f.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = newFiles.splice(fromIdx, 1);
    newFiles.splice(toIdx, 0, moved);
    onReorder(category, newFiles);
    setDragging(touchStartRef.current.id);
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setDragging(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {files.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {files.length} archivo{files.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {files.length > 0 && (
          <div
            ref={containerRef}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
          >
            {files.map((doc) => (
              <div
                key={doc.id}
                data-file-id={doc.id}
                draggable
                onDragStart={() => handleDragStart(doc.id)}
                onDragOver={(e) => handleDragOver(e, doc.id)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, doc.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`group relative flex flex-col items-center rounded-md border bg-muted/30 p-2 transition-shadow ${
                  dragging === doc.id ? "opacity-50 ring-2 ring-primary" : "hover:shadow-sm"
                }`}
              >
                <div className="absolute left-1 top-1 cursor-grab text-muted-foreground/40">
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
                <div className="absolute right-1 top-1 z-10 flex gap-0.5 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRotateFile(category, doc.id); }}
                    onTouchEnd={(e) => { e.stopPropagation(); }}
                    className="rounded p-1 hover:bg-muted active:scale-95"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDeleteTarget(doc.id); }}
                    onTouchEnd={(e) => { e.stopPropagation(); }}
                    className="rounded p-1 hover:bg-destructive/10 active:scale-95"
                  >
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
                {doc.preview ? (
                  <img
                    src={doc.preview}
                    alt={doc.file.name}
                    className="h-20 w-full rounded object-cover"
                    style={{ transform: `rotate(${doc.rotation}deg)` }}
                  />
                ) : (
                  <div className="flex h-20 w-full items-center justify-center rounded bg-muted">
                    <Eye className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
                <p className="mt-1 w-full truncate text-center text-[10px] text-muted-foreground">
                  {doc.file.name}
                </p>
              </div>
            ))}
          </div>
        )}
        <FileUploadZone
          accept=".pdf,.jpg,.jpeg,.png,.heic"
          multiple
          onFiles={(f) => onAddFiles(category, f)}
          label={`Agregar ${title.toLowerCase()}`}
          description="PDF, JPG, PNG o HEIC"
          showCamera
        />
      </CardContent>
    </Card>
  );
}
