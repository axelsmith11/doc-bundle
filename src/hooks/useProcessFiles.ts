import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocFile } from "@/components/DocumentSection";

type CategoryKey = "guia_remision" | "orden_compra" | "partes_ingreso";

let fileIdCounter = 0;
function generateFileId() {
  return `file_${++fileIdCounter}_${Date.now()}`;
}

async function fileToPreview(file: File): Promise<string | undefined> {
  if (file.type.startsWith("image/")) {
    return URL.createObjectURL(file);
  }
  return undefined;
}

function storagePath(userId: string, processId: string, category: string, fileName: string) {
  return `${userId}/${processId}/${category}/${fileName}`;
}

export function useProcessFiles(processId: string | undefined, userId: string | undefined) {
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const uploadFile = useCallback(
    async (file: File, category: string): Promise<string | null> => {
      if (!processId || !userId) return null;
      const path = storagePath(userId, processId, category, file.name);
      const { error } = await supabase.storage
        .from("process-files")
        .upload(path, file, { upsert: true });
      if (error) {
        console.error("Upload error:", error);
        return null;
      }

      // Upsert record in process_files
      const { error: dbError } = await supabase.from("process_files").upsert(
        {
          process_id: processId,
          user_id: userId,
          category,
          file_name: file.name,
          file_type: file.type,
          storage_path: path,
          sort_order: 0,
        },
        { onConflict: "process_id,category,file_name" }
      );
      if (dbError) {
        console.error("DB upsert error:", dbError);
        toast.error("Error guardando referencia del archivo");
        return null;
      }

      return path;
    },
    [processId, userId]
  );

  const uploadBaseFiles = useCallback(
    async (comprobantePdf: File | null, sunatZip: File | null) => {
      if (!processId || !userId) return;
      setUploading(true);
      try {
        const uploads: Promise<any>[] = [];
        if (comprobantePdf) {
          uploads.push(uploadFile(comprobantePdf, "comprobante"));
        }
        if (sunatZip) {
          uploads.push(uploadFile(sunatZip, "sunat_zip"));
        }
        await Promise.all(uploads);
      } finally {
        setUploading(false);
      }
    },
    [processId, userId, uploadFile]
  );

  const uploadSupportDocs = useCallback(
    async (category: string, files: File[]) => {
      if (!processId || !userId) return;
      await Promise.all(files.map((f) => uploadFile(f, category)));
    },
    [processId, userId, uploadFile]
  );

  const deleteFile = useCallback(
    async (category: string, fileName: string) => {
      if (!processId || !userId) return;
      const path = storagePath(userId, processId, category, fileName);
      await supabase.storage.from("process-files").remove([path]);
      await supabase
        .from("process_files")
        .delete()
        .eq("process_id", processId)
        .eq("category", category)
        .eq("file_name", fileName);
    },
    [processId, userId]
  );

  const downloadFile = useCallback(
    async (path: string): Promise<File | null> => {
      const { data, error } = await supabase.storage
        .from("process-files")
        .download(path);
      if (error || !data) return null;
      const fileName = path.split("/").pop() || "file";
      return new File([data], fileName, { type: data.type });
    },
    []
  );

  const loadAllFiles = useCallback(async (): Promise<{
    comprobante: File | null;
    sunatZip: File | null;
    supportDocs: Record<CategoryKey, DocFile[]>;
  }> => {
    const result = {
      comprobante: null as File | null,
      sunatZip: null as File | null,
      supportDocs: {
        guia_remision: [] as DocFile[],
        orden_compra: [] as DocFile[],
        partes_ingreso: [] as DocFile[],
      },
    };

    if (!processId || !userId) return result;
    setLoadingFiles(true);

    try {
      const { data: records } = await supabase
        .from("process_files")
        .select("*")
        .eq("process_id", processId)
        .order("sort_order", { ascending: true });

      if (!records || records.length === 0) return result;

      for (const rec of records) {
        const file = await downloadFile(rec.storage_path);
        if (!file) continue;

        if (rec.category === "comprobante") {
          result.comprobante = file;
        } else if (rec.category === "sunat_zip") {
          result.sunatZip = file;
        } else if (rec.category in result.supportDocs) {
          const preview = await fileToPreview(file);
          result.supportDocs[rec.category as CategoryKey].push({
            id: generateFileId(),
            file,
            preview,
            rotation: 0,
          });
        }
      }
    } catch (err) {
      console.error("Error loading files:", err);
      toast.error("Error cargando archivos guardados");
    } finally {
      setLoadingFiles(false);
    }

    return result;
  }, [processId, userId, downloadFile]);

  return {
    uploading,
    loadingFiles,
    uploadFile,
    uploadBaseFiles,
    uploadSupportDocs,
    deleteFile,
    loadAllFiles,
  };
}
