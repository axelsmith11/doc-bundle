import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, Search, FileSpreadsheet, Clock, CheckCircle2, Loader2, CalendarDays, Trash2, CalendarIcon, X,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Cita {
  id: string;
  name: string | null;
  fecha_despacho: string | null;
  status: string;
  ocs_count: number;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export default function CitasDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<Date>();
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadCitas();
    const handleFocus = () => loadCitas();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const loadCitas = async () => {
    const { data, error } = await supabase
      .from("citas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) toast.error("Error cargando citas");
    else setCitas((data as Cita[]) || []);
    setLoading(false);
  };

  const createCita = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("citas")
      .insert({ user_id: user.id })
      .select()
      .single();

    setCreating(false);
    if (error) toast.error("Error creando cita");
    else if (data) navigate(`/cita/${data.id}`);
  };

  const deleteCita = async () => {
    if (!deleteTarget) return;
    const { data: files } = await supabase
      .from("cita_files")
      .select("storage_path")
      .eq("cita_id", deleteTarget);
    if (files?.length) {
      await supabase.storage.from("cita-files").remove(files.map((f) => f.storage_path));
    }
    await supabase.from("cita_files").delete().eq("cita_id", deleteTarget);
    await supabase.from("citas").delete().eq("id", deleteTarget);
    setDeleteTarget(null);
    setCitas((prev) => prev.filter((c) => c.id !== deleteTarget));
    toast.success("Cita eliminada");
  };

  const filtered = citas.filter((c) => {
    if (search && !(c.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFilter) {
      // Filter by fecha_despacho or created_at
      const despacho = c.fecha_despacho
        ? new Date(c.fecha_despacho + "T00:00:00").toDateString()
        : null;
      const created = new Date(c.created_at).toDateString();
      const target = dateFilter.toDateString();
      if (despacho !== target && created !== target) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Mis citas</h1>
          <p className="text-sm text-muted-foreground">
            {citas.length} cita{citas.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={createCita} disabled={creating}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Nueva cita
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-[200px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter ? format(dateFilter, "dd MMM yyyy", { locale: es }) : "Filtrar por fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFilter}
                onSelect={setDateFilter}
                initialFocus
                locale={es}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {dateFilter && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setDateFilter(undefined)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search || dateFilter ? "No se encontraron citas" : "Aún no tienes citas. ¡Crea la primera!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((cita) => (
            <Card
              key={cita.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/cita/${cita.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {cita.name || "Sin nombre"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {cita.fecha_despacho && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(cita.fecha_despacho + "T00:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {cita.items_count > 0 && (
                      <span>{cita.items_count} ítems · {cita.ocs_count} OC(s)</span>
                    )}
                    <span>
                      {new Date(cita.created_at).toLocaleDateString("es-PE", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <Badge variant={cita.status === "completed" ? "default" : "secondary"}>
                    {cita.status === "completed" ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : (
                      <Clock className="mr-1 h-3 w-3" />
                    )}
                    {cita.status === "completed" ? "Completada" : "Borrador"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(cita.id); }}
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
            <AlertDialogTitle>¿Eliminar cita?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente la cita y todos sus archivos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCita} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
