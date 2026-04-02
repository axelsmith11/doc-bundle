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
      // PASO 1: Abre ventana de Tai Loy en login
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
      toast.info("Abriendo Tai Loy. Por favor espera...");

      // Espera a que la página cargue completamente
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // PASO 2: Inyecta script MEJORADO para llenar login
      const loginScript = `
        (function() {
          try {
            console.log("=== INICIANDO LOGIN AUTOMÁTICO ===");

            // BÚSQUEDA EXHAUSTIVA DE CAMPOS
            const allInputs = document.querySelectorAll('input');
            console.log("Total de inputs encontrados:", allInputs.length);

            let userInput = null;
            let passInput = null;
            let privacyCheckbox = null;

            // Busca por atributos específicos
            for (const input of allInputs) {
              const id = input.id.toLowerCase();
              const name = input.name.toLowerCase();
              const type = input.type.toLowerCase();
              const placeholder = input.placeholder.toLowerCase();

              console.log("Input:", { id, name, type, placeholder });

              // Usuario
              if (type === 'text' && !userInput) {
                userInput = input;
              }

              // Contraseña
              if (type === 'password' && !passInput) {
                passInput = input;
              }

              // Checkbox de políticas
              if (type === 'checkbox' && !privacyCheckbox) {
                privacyCheckbox = input;
              }
            }

            // Llena usuario
            if (userInput) {
              console.log("Llenando usuario...");
              userInput.focus();
              userInput.value = "${config.user}";
              userInput.dispatchEvent(new Event('input', { bubbles: true }));
              userInput.dispatchEvent(new Event('change', { bubbles: true }));
              userInput.dispatchEvent(new Event('blur', { bubbles: true }));
              console.log("✓ Usuario llenado");
            } else {
              console.error("✗ No se encontró campo de usuario");
            }

            // Llena contraseña
            if (passInput) {
              console.log("Llenando contraseña...");
              passInput.focus();
              passInput.value = "${config.password}";
              passInput.dispatchEvent(new Event('input', { bubbles: true }));
              passInput.dispatchEvent(new Event('change', { bubbles: true }));
              passInput.dispatchEvent(new Event('blur', { bubbles: true }));
              console.log("✓ Contraseña llenada");
            } else {
              console.error("✗ No se encontró campo de contraseña");
            }

            // Acepta políticas
            if (privacyCheckbox && !privacyCheckbox.checked) {
              console.log("Aceptando políticas...");
              privacyCheckbox.checked = true;
              privacyCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
              privacyCheckbox.dispatchEvent(new Event('click', { bubbles: true }));
              console.log("✓ Políticas aceptadas");
            }

            // Busca botón de envío
            const buttons = document.querySelectorAll('button');
            let submitButton = null;

            for (const btn of buttons) {
              const text = btn.textContent.toLowerCase();
              if (text.includes('ingresar') || text.includes('login') || text.includes('submit')) {
                submitButton = btn;
                break;
              }
            }

            if (submitButton) {
              console.log("Presionando botón Ingresar...");
              setTimeout(() => {
                submitButton.click();
                console.log("✓ Botón presionado");
              }, 500);
            } else {
              console.error("✗ No se encontró botón de envío");
              console.log("Botones disponibles:", Array.from(buttons).map(b => b.textContent));
            }

            console.log("=== SCRIPT DE LOGIN COMPLETADO ===");
          } catch (e) {
            console.error("ERROR EN SCRIPT DE LOGIN:", e);
          }
        })();
      `;

      try {
        newWindow.eval(loginScript);
        toast.success("Credenciales inyectadas. Presiona Ingresar en la ventana.");
      } catch (e) {
        console.error("Error inyectando script:", e);
        toast.warning("Abre DevTools (F12) en la ventana para ver los errores");
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
