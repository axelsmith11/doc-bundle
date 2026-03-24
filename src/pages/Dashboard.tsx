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
  LogOut,
  Loader2,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Process = Tables<"processes">;

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProcesses();
  }, []);

  const loadProcesses = async () => {
    const { data, error } = await supabase
      .from("processes")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Error cargando procesos");
    } else {
      setProcesses(data || []);
    }
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
    if (error) {
      toast.error("Error creando proceso");
    } else if (data) {
      navigate(`/proceso/${data.id}`);
    }
  };

  const filtered = processes.filter(
    (p) =>
      !search ||
      (p.invoice_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold text-foreground">FacturaPack</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
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
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge
                    variant={process.status === "completed" ? "default" : "secondary"}
                    className="ml-3 shrink-0"
                  >
                    {process.status === "completed" ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : (
                      <Clock className="mr-1 h-3 w-3" />
                    )}
                    {process.status === "completed" ? "Completado" : "Borrador"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
