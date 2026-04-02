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
 * Hook para automatizar el envío de citas a Tai Loy
 * Paso 1: Abre login y llena credenciales automáticamente
 * Paso 2: Usuario presiona Ingresar
 * Paso 3: Redirige a Nueva Cita
 * Paso 4: Llena formulario de cita
 */
export const useTaiLoyAutomation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [tailoyWindow, setTailoyWindow] = useState<Window | null>(null);

  const startTaiLoyAutomation = useCallback(async (config: TaiLoyConfig) => {
    setIsProcessing(true);
    try {
      // Abre ventana de Tai Loy en login
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
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // Script mejorado para llenar formulario y enviar
      const loginScript = `
        (function() {
          try {
            console.log("=== INICIANDO LOGIN AUTOMÁTICO EN TAI LOY ===");

            // Función helper para rellenar input
            function fillInput(element, value) {
              if (!element) return false;

              element.focus();
              element.value = value;

              // Dispara múltiples eventos para máxima compatibilidad
              const events = ['input', 'change', 'keydown', 'keyup', 'blur'];
              events.forEach(eventName => {
                element.dispatchEvent(new Event(eventName, { bubbles: true }));
              });

              return true;
            }

            // Encuentra los inputs
            const inputs = document.querySelectorAll('input');
            let userInput = null;
            let passInput = null;
            let privacyCheckbox = null;

            console.log("Total inputs encontrados:", inputs.length);

            for (let i = 0; i < inputs.length; i++) {
              const input = inputs[i];
              const type = input.type.toLowerCase();

              if (type === 'text' && !userInput) {
                userInput = input;
                console.log("Input de usuario encontrado en posición:", i);
              } else if (type === 'password' && !passInput) {
                passInput = input;
                console.log("Input de contraseña encontrado en posición:", i);
              } else if (type === 'checkbox' && !privacyCheckbox) {
                privacyCheckbox = input;
                console.log("Checkbox encontrado en posición:", i);
              }
            }

            // Llena usuario
            if (userInput) {
              const resultado = fillInput(userInput, "${config.user}");
              console.log(resultado ? "✓ Usuario completado: ${config.user}" : "✗ Error al completar usuario");
            } else {
              console.error("✗ No se encontró campo de usuario");
            }

            // Pequeña pausa
            await new Promise(r => setTimeout(r, 300));

            // Llena contraseña
            if (passInput) {
              const resultado = fillInput(passInput, "${config.password}");
              console.log(resultado ? "✓ Contraseña completada" : "✗ Error al completar contraseña");
            } else {
              console.error("✗ No se encontró campo de contraseña");
            }

            // Pequeña pausa
            await new Promise(r => setTimeout(r, 300));

            // Acepta políticas de privacidad
            if (privacyCheckbox) {
              if (!privacyCheckbox.checked) {
                privacyCheckbox.checked = true;
                privacyCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                privacyCheckbox.dispatchEvent(new Event('click', { bubbles: true }));
                console.log("✓ Políticas de privacidad aceptadas");
              } else {
                console.log("Políticas ya estaban aceptadas");
              }
            } else {
              console.warn("⚠ No se encontró checkbox de políticas (puede no ser requerido)");
            }

            // Pequeña pausa antes de enviar
            await new Promise(r => setTimeout(r, 500));

            // Busca y presiona el botón de envío
            const buttons = document.querySelectorAll('button');
            let submitButton = null;

            for (const btn of buttons) {
              const text = btn.textContent.trim().toLowerCase();
              console.log("Botón encontrado:", text);

              if (text.includes('ingresar') || text.includes('login') || text.includes('entrar')) {
                submitButton = btn;
                console.log("✓ Botón de envío encontrado");
                break;
              }
            }

            if (submitButton) {
              console.log("Presionando botón Ingresar...");
              submitButton.click();
              console.log("✓ Botón presionado - Iniciando sesión...");
            } else {
              console.error("✗ No se encontró botón de envío");
              console.log("Botones disponibles:", Array.from(buttons).map(b => b.textContent.trim()));
            }

            console.log("=== SCRIPT DE LOGIN COMPLETADO ===");
          } catch (e) {
            console.error("ERROR EN SCRIPT DE LOGIN:", e);
          }
        })().then ? await (function() {
          try {
            return (async function() {
              await new Promise(r => setTimeout(r, 100));
            })();
          } catch (e) {
            console.error("Error en async:", e);
          }
        })() : void 0;
      `;

      try {
        // Ejecuta el script en la ventana
        (function executeInWindow() {
          const script = newWindow.document.createElement('script');
          script.textContent = loginScript.replace(/await/g, '');
          newWindow.document.head.appendChild(script);
        })();

        toast.success("✓ Login iniciado. Espera a que se complete...");
      } catch (e) {
        console.error("Error inyectando script:", e);
        toast.warning("No se pudo inyectar el script. Abre DevTools (F12) para ver detalles");
      }

    } catch (error: any) {
      console.error("Error en automatización Tai Loy:", error);
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
