import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { FileArchive, FileSpreadsheet, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Facturas", path: "/", icon: FileArchive },
  { label: "Citas", path: "/citas", icon: FileSpreadsheet },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" || location.pathname.startsWith("/proceso");
    if (path === "/citas") return location.pathname === "/citas" || location.pathname.startsWith("/cita/");
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />
              <span className="font-display text-lg font-bold text-foreground">FacturaPack</span>
            </div>

            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
