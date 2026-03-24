import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocFile } from "@/components/DocumentSection";

type CategoryKey = "guia_remision" | "orden_compra" | "partes_ingreso";
type ProcessCategory = CategoryKey | "comprobante_pdf" | "sunat_zip";
type StorageCategory = ProcessCategory | "comprobante";

type StoredFileRecord = {
  process_id: string;
  user_id: string;
  category: ProcessCategory;
  file_name: string;
  file_type: string;
  storage_path: string;
  sort_order: number;
};

const DB_CATEGORIES: ProcessCategory[] = [
  "comprobante_pdf",
  "sunat_zip",
  "guia_remision",
  "orden_compra",
  "partes_ingreso",
];

const STORAGE_CATEGORIES: StorageCategory[] = [
  "comprobante_pdf",
  "comprobante",
  "sunat_zip",
  "guia_remision",
  "orden_compra",
  "partes_ingreso",
];

function normalizeCategory(category: string): ProcessCategory | null {
  if (category === "comprobante") return "comprobante_pdf";
  if ((DB_CATEGORIES as string[]).includes(category)) return category as ProcessCategory;
  return null;
}

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

function inferFileType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".heic")) return "image/heic";
  return "application/octet-stream";
}

async function listStoredFilesFromStorage(userId: string, processId: string): Promise<StoredFileRecord[]> {
  const listResults = await Promise.all(
    STORAGE_CATEGORIES.map(async (storageCategory) => {
      const category = normalizeCategory(storageCategory);
      if (!category) return [] as StoredFileRecord[];

      const { data, error } = await supabase.storage
        .from("process-files")
        .list(`${userId}/${processId}/${storageCategory}`, {
          limit: 200,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        console.error(`Storage list error (${storageCategory}):`, error);
        return [] as StoredFileRecord[];
      }

      return (data ?? [])
        .filter((entry) => !!entry.name)
        .map((entry, index) => ({
          process_id: processId,
          user_id: userId,
          category,
          file_name: entry.name,
          file_type: inferFileType(entry.name),
          storage_path: storagePath(userId, processId, storageCategory, entry.name),
          sort_order: index,
        }));
    })
  );

  return listResults.flat();
}

export function useProcessFiles(processId: string | undefined, userId: string | undefined) {
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const uploadFile = useCallback(
    async (file: File, category: string): Promise<string | null> => {
      if (!processId || !userId) return null;

      const dbCategory = normalizeCategory(category);
      if (!dbCategory) {
        toast.error("Categoría de archivo no válida");
        return null;
      }

      const path = storagePath(userId, processId, dbCategory, file.name);
      const { error } = await supabase.storage
        .from("process-files")
        .upload(path, file, { upsert: true });
      if (error) {
        console.error("Upload error:", error);
        return null;
      }

      const { error: dbError } = await supabase.from("process_files").upsert(
        {
          process_id: processId,
          user_id: userId,
          category: dbCategory,
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
          uploads.push(uploadFile(comprobantePdf, "comprobante_pdf"));
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
      if (!processId || !userId) {
        return { savedFiles: [] as File[], failedFiles: files };
      }

      const uploads = await Promise.all(
        files.map(async (file) => ({ file, path: await uploadFile(file, category) }))
      );

      return {
        savedFiles: uploads.filter((item) => !!item.path).map((item) => item.file),
        failedFiles: uploads.filter((item) => !item.path).map((item) => item.file),
      };
    },
    [processId, userId, uploadFile]
  );

  const deleteFile = useCallback(
    async (category: string, fileName: string) => {
      if (!processId || !userId) return;

      const dbCategory = normalizeCategory(category);
      if (!dbCategory) return;

      const { data: storedRecord } = await supabase
        .from("process_files")
        .select("storage_path")
        .eq("process_id", processId)
        .eq("category", dbCategory)
        .eq("file_name", fileName)
        .maybeSingle();

      const pathsToRemove = new Set<string>([
        storagePath(userId, processId, dbCategory, fileName),
      ]);

      if (category === "comprobante") {
        pathsToRemove.add(storagePath(userId, processId, "comprobante", fileName));
      }

      if (storedRecord?.storage_path) {
        pathsToRemove.add(storedRecord.storage_path);
      }

      await supabase.storage.from("process-files").remove(Array.from(pathsToRemove));
      await supabase
        .from("process_files")
        .delete()
        .eq("process_id", processId)
        .eq("category", dbCategory)
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
      const { data: records, error: recordsError } = await supabase
        .from("process_files")
        .select("process_id,user_id,category,file_name,file_type,storage_path,sort_order")
        .eq("process_id", processId)
        .order("sort_order", { ascending: true });

      if (recordsError) {
        console.error("Error loading process_files:", recordsError);
      }

      const dbRecords: StoredFileRecord[] = (records ?? []).map((rec) => ({
        process_id: rec.process_id,
        user_id: rec.user_id,
        category: rec.category as ProcessCategory,
        file_name: rec.file_name,
        file_type: rec.file_type,
        storage_path: rec.storage_path,
        sort_order: rec.sort_order,
      }));

      const storageRecords = await listStoredFilesFromStorage(userId, processId);

      const mergedByKey = new Map<string, StoredFileRecord>();
      for (const rec of dbRecords) {
        mergedByKey.set(`${rec.category}::${rec.file_name}`, rec);
      }

      const missingInDb: StoredFileRecord[] = [];
      for (const rec of storageRecords) {
        const key = `${rec.category}::${rec.file_name}`;
        if (!mergedByKey.has(key)) {
          mergedByKey.set(key, rec);
          missingInDb.push(rec);
        }
      }

      if (missingInDb.length > 0) {
        const { error: recoverError } = await supabase.from("process_files").upsert(missingInDb, {
          onConflict: "process_id,category,file_name",
        });
        if (recoverError) {
          console.error("Error recovering missing process_files rows:", recoverError);
        }
      }

      const mergedRecords = Array.from(mergedByKey.values()).sort(
        (a, b) => a.sort_order - b.sort_order
      );

      if (mergedRecords.length === 0) return result;

      for (const rec of mergedRecords) {
        const file = await downloadFile(rec.storage_path);
        if (!file) continue;

        if (rec.category === "comprobante_pdf") {
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
