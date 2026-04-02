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
 * Abre una ventana del navegador y guía el flujo hasta antes de guardar
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

      // Espera a que la página de login cargue
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Inyecta script para llenar credenciales automáticamente
      const loginScript = `
        (function() {
          try {
            console.log("Iniciando automatización de login en Tai Loy...");

            // Busca campos de usuario y contraseña (múltiples selectores para compatibilidad)
            const userInputs = document.querySelectorAll('input[type="text"], input[type="email"], input#usuario, input[name="usuario"]');
            const passInput = document.querySelector('input[type="password"], input#contraseña, input[name="contraseña"]');
            const privacyCheckbox = document.querySelector('input[type="checkbox"]');
            const submitButton = document.querySelector('button[type="submit"]');

            // Llena credenciales
            if (userInputs.length > 0) {
              userInputs[0].value = "${config.user}";
              userInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
              userInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
            }

            if (passInput) {
              passInput.value = "${config.password}";
              passInput.dispatchEvent(new Event('input', { bubbles: true }));
              passInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Acepta políticas
            if (privacyCheckbox) {
              privacyCheckbox.checked = true;
              privacyCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Envía formulario
            if (submitButton) {
              setTimeout(() => {
                submitButton.click();
                console.log("Formulario de login enviado automáticamente");
              }, 800);
            }

            console.log("Script de login completado");
          } catch (e) {
            console.error("Error en script de login:", e);
          }
        })();
      `;

      try {
        newWindow.eval(loginScript);
      } catch (e) {
        console.error("Error inyectando script:", e);
        toast.warning("No se pudo automatizar el login. Completa manualmente.");
      }

      // Espera a que el usuario navegue después del login (aproximadamente 3-5 segundos)
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Intenta navegar a Solicitud de Citas > Nueva Cita
      try {
        newWindow.location.href = "https://www1.tailoy.com.pe/SolicitudDeCitas/Nueva";
      } catch (e) {
        console.warn("No se pudo redirigir automáticamente:", e);
        toast.info("Por favor, ve a Solicitud de Cita > Nueva Cita manualmente");
      }

      // Espera a que cargue la página de nueva cita
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Inyecta script para llenar formulario de cita
      const citaScript = `
        (function() {
          try {
            // Variables disponibles desde el padre
            const excelFileName = "${config.excelFileName}";
            const fecha = "${config.fecha}";
            const hora = "${config.hora}";

            // Busca campos en el formulario
            const fileInput = document.querySelector('input[type="file"]');
            const dateInputs = document.querySelectorAll('input[type="date"]');
            const timeSelects = document.querySelectorAll('select');
            const cantCodigos = document.querySelector('input[placeholder*="Códigos"]');

            console.log("Elementos encontrados:", {
              fileInput: !!fileInput,
              dateInputs: dateInputs.length,
              timeSelects: timeSelects.length,
              cantCodigos: !!cantCodigos
            });

            // Llena fecha
            if (dateInputs.length > 0) {
              dateInputs[0].value = fecha;
              dateInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
              dateInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Llena hora
            if (timeSelects.length > 0) {
              const [horaInicio, horaFin] = hora.split(' - ');
              if (timeSelects[0]) {
                timeSelects[0].value = horaInicio;
                timeSelects[0].dispatchEvent(new Event('change', { bubbles: true }));
              }
              if (timeSelects[1]) {
                timeSelects[1].value = horaFin;
                timeSelects[1].dispatchEvent(new Event('change', { bubbles: true }));
              }
            }

            console.log("Formulario de cita llenado automáticamente");
            console.log("Archivo:", excelFileName);
            console.log("Fecha:", fecha);
            console.log("Hora:", hora);
          } catch (e) {
            console.error("Error en script de cita:", e);
          }
        })();
      `;

      try {
        newWindow.eval(citaScript);
        toast.success("Formulario llenado automáticamente. Sube el Excel y confirma.");
      } catch (e) {
        console.error("Error inyectando script de cita:", e);
        toast.info("Por favor, llena manualmente el formulario con los datos de tu cita");
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
