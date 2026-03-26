import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Search,
  FileArchive,
  Clock,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";
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
import type { Tables } from "@/integrations/supabase/types";

type Process = Tables<"processes">;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadProcesses();
    const handleFocus = () => loadProcesses();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const loadProcesses = async () => {
    const { data, error } = await supabase
      .from("processes")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) toast.error("Error cargando procesos");
    else setProcesses(data || []);
    setLoading(false);
  };

  const createProcess = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("processes")
      .insert({ user_id: user.id })
      .select()
      .single();

    setCreating(false);
    if (error) toast.error("Error creando proceso");
    else if (data) navigate(`/proceso/${data.id}`);
  };

  const deleteProcess = async () => {
    if (!deleteTarget) return;
    // Delete files from storage
    const { data: files } = await supabase
      .from("process_files")
      .select("storage_path")
      .eq("process_id", deleteTarget);
    if (files?.length) {
      await supabase.storage.from("process-files").remove(files.map((f) => f.storage_path));
    }
    await supabase.from("process_files").delete().eq("process_id", deleteTarget);
    await supabase.from("processes").delete().eq("id", deleteTarget);
    setDeleteTarget(null);
    setProcesses((prev) => prev.filter((p) => p.id !== deleteTarget));
    toast.success("Proceso eliminado");
  };

  const filtered = processes.filter(
    (p) => !search || (p.invoice_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Top bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Mis facturas</h1>
          <p className="text-sm text-muted-foreground">
            {processes.length} proceso{processes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={createProcess} disabled={creating}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Nuevo proceso
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre de factura…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileArchive className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "No se encontraron procesos" : "Aún no tienes procesos. ¡Crea el primero!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((process) => (
            <Card
              key={process.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/proceso/${process.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {process.invoice_name || "Sin nombre"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Actualizado {new Date(process.updated_at).toLocaleDateString("es-PE", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <Badge variant={process.status === "completed" ? "default" : "secondary"}>
                    {process.status === "completed" ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : (
                      <Clock className="mr-1 h-3 w-3" />
                    )}
                    {process.status === "completed" ? "Completado" : "Borrador"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(process.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proceso?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente el proceso y todos sus archivos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProcess} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
