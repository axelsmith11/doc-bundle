import { useState, useCallback } from "react";
import { toast } from "sonner";

interface TaiLoyConfig {
  user: string;
  password: string;
  excelBase64: string;
  excelFileName: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM:00 - HH:MM:00
}

/**
 * Hook para automatizar login en Tai Loy
 * Flujo:
 * 1. Abre: https://www1.tailoy.com.pe/AgendamientoCitas/login
 * 2. Llena usuario y contraseña automáticamente
 * 3. Marca checkbox "Declaro haber leído las políticas"
 * 4. Click en "Ingresar"
 * 5. Se redirige a: https://www1.tailoy.com.pe/AgendamientoCitas/Home
 * 6. Usuario ve el menú con "Solicitud de Citas"
 */
export const useTaiLoyAutomation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [tailoyWindow, setTailoyWindow] = useState<Window | null>(null);

  const startTaiLoyAutomation = useCallback(async (config: TaiLoyConfig) => {
    setIsProcessing(true);
    try {
      // Abre ventana de Tai Loy
      const newWindow = window.open(
        "https://www1.tailoy.com.pe/AgendamientoCitas/login",
        "tailoy_cita",
        "width=1200,height=800"
      );

      if (!newWindow) {
        toast.error("No se pudo abrir ventana de Tai Loy. Verifica permisos de pop-ups");
        setIsProcessing(false);
        return;
      }

      setTailoyWindow(newWindow);
      toast.info("Abriendo Tai Loy. Iniciando sesión automáticamente...");

      // Espera a que cargue
      await new Promise((resolve) => setTimeout(resolve, 4500));

      // Script mejorado con eval()
      const autoLoginScript = `
        (function autoLogin() {
          console.log("Buscando campos de login...");

          const inputs = document.querySelectorAll('input');
          let userField = null;
          let passField = null;
          let checkBox = null;

          // Busca campos
          for (let inp of inputs) {
            const type = inp.getAttribute('type') || inp.type;
            if (type === 'text' && !userField) userField = inp;
            if (type === 'password' && !passField) passField = inp;
            if (type === 'checkbox' && !checkBox) checkBox = inp;
          }

          if (!userField || !passField) {
            console.error("No se encontraron campos");
            return;
          }

          // Llena campos
          userField.value = '${config.user}';
          userField.dispatchEvent(new Event('input', { bubbles: true }));
          userField.dispatchEvent(new Event('change', { bubbles: true }));

          passField.value = '${config.password}';
          passField.dispatchEvent(new Event('input', { bubbles: true }));
          passField.dispatchEvent(new Event('change', { bubbles: true }));

          // Marca checkbox
          if (checkBox) {
            checkBox.checked = true;
            checkBox.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Busca y presiona botón
          setTimeout(() => {
            const btns = document.querySelectorAll('button');
            for (let btn of btns) {
              if (btn.textContent.toLowerCase().includes('ingresar')) {
                btn.click();
                console.log('Login enviado');
                break;
              }
            }
          }, 500);
        })();
      `;

      try {
        newWindow.eval(autoLoginScript);
        toast.success("✓ Login completado automáticamente");
      } catch (e) {
        console.error("Error con eval:", e);
        toast.error("No se pudo inyectar script. Completa manualmente: usuario y contraseña, marca políticas, presiona Ingresar");
      }

    } catch (error: any) {
      console.error("Error:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    startTaiLoyAutomation,
    isProcessing,
    tailoyWindow,
  };
};
