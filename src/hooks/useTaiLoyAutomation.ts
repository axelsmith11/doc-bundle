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
      // Paso 1: Abre ventana de Tai Loy en login
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

      // Espera a que la página cargue completamente
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Paso 2: Inyecta script para llenar login y enviar
      const loginScript = `
        (function() {
          console.log("=== INICIANDO LOGIN AUTOMÁTICO EN TAI LOY ===");

          try {
            // Encuentra todos los inputs
            const inputs = document.querySelectorAll('input');
            let userInput = null;
            let passInput = null;
            let privacyCheckbox = null;

            console.log("Total inputs encontrados:", inputs.length);

            // Busca por tipo
            for (let i = 0; i < inputs.length; i++) {
              const input = inputs[i];
              const type = input.type ? input.type.toLowerCase() : '';

              if (type === 'text' && !userInput) {
                userInput = input;
                console.log("✓ Input de usuario encontrado");
              } else if (type === 'password' && !passInput) {
                passInput = input;
                console.log("✓ Input de contraseña encontrado");
              } else if (type === 'checkbox' && !privacyCheckbox) {
                privacyCheckbox = input;
                console.log("✓ Checkbox de políticas encontrado");
              }
            }

            // Función para llenar input
            function fillInput(element, value) {
              if (!element) return false;
              element.focus();
              element.value = value;

              const events = ['input', 'change', 'keydown', 'keyup', 'blur'];
              events.forEach(evt => {
                element.dispatchEvent(new Event(evt, { bubbles: true }));
              });
              return true;
            }

            // Llena usuario
            if (userInput) {
              fillInput(userInput, "${config.user}");
              console.log("✓ Usuario: ${config.user}");
            }

            // Espera pequeño
            setTimeout(() => {
              // Llena contraseña
              if (passInput) {
                fillInput(passInput, "${config.password}");
                console.log("✓ Contraseña completada");
              }

              // Espera pequeño
              setTimeout(() => {
                // Marca checkbox
                if (privacyCheckbox && !privacyCheckbox.checked) {
                  privacyCheckbox.checked = true;
                  privacyCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                  privacyCheckbox.dispatchEvent(new Event('click', { bubbles: true }));
                  console.log("✓ Políticas marcadas");
                }

                // Busca botón "Ingresar"
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                  const text = btn.textContent ? btn.textContent.trim().toLowerCase() : '';
                  if (text.includes('ingresar') || text.includes('entrar')) {
                    console.log("✓ Presionando Ingresar...");
                    btn.click();
                    console.log("✓ Sesión iniciada - Redirigiendo...");
                    break;
                  }
                }
              }, 300);
            }, 300);

          } catch (e) {
            console.error("ERROR:", e);
          }
        })();
      `;

      try {
        // Ejecuta el script en la ventana
        const script = newWindow.document.createElement('script');
        script.textContent = loginScript;
        newWindow.document.body.appendChild(script);

        toast.success("✓ Login iniciado. Deberías estar en el Home de Tai Loy en segundos...");
      } catch (e) {
        console.error("Error inyectando script:", e);
        toast.error("No se pudo inyectar el script automáticamente. Completa el login manualmente.");
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
