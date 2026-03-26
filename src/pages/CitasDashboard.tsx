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
  Plus, Search, FileSpreadsheet, Clock, CheckCircle2, Loader2, CalendarDays, Trash2,
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
      .order("updated_at", { ascending: false });

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

  const filtered = citas.filter(
    (c) => !search || (c.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

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

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "No se encontraron citas" : "Aún no tienes citas. ¡Crea la primera!"}
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
                      Actualizado {new Date(cita.updated_at).toLocaleDateString("es-PE", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <Badge
                  variant={cita.status === "completed" ? "default" : "secondary"}
                  className="ml-3 shrink-0"
                >
                  {cita.status === "completed" ? (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  ) : (
                    <Clock className="mr-1 h-3 w-3" />
                  )}
                  {cita.status === "completed" ? "Completada" : "Borrador"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
