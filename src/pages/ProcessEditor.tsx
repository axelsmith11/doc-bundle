import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileArchive,
  Save,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Archive,
} from "lucide-react";
import FileUploadZone from "@/components/FileUploadZone";
import DocumentSection, { type DocFile } from "@/components/DocumentSection";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

type CategoryKey = "guia_remision" | "orden_compra" | "partes_ingreso";

const SUPPORT_CATEGORIES: { key: CategoryKey; title: string; pdfSuffix: string }[] = [
  { key: "guia_remision", title: "Guías de Remisión", pdfSuffix: "Guia_Remision" },
  { key: "orden_compra", title: "Órdenes de Compra (O.C.)", pdfSuffix: "O.C." },
  { key: "partes_ingreso", title: "Partes de Ingreso", pdfSuffix: "Partes_de_ingreso" },
];

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

async function imageToPdfBytes(file: File, rotation: number): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.create();

  let image;
  if (file.type === "image/png") {
    image = await pdfDoc.embedPng(arrayBuffer);
  } else {
    image = await pdfDoc.embedJpg(arrayBuffer);
  }

  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

  if (rotation) {
    page.setRotation(({ type: 0, angle: rotation }) as any);
  }

  return pdfDoc.save();
}

async function mergeFilesToPdf(docs: DocFile[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const doc of docs) {
    let pdfBytes: ArrayBuffer | Uint8Array;

    if (doc.file.type === "application/pdf") {
      pdfBytes = await doc.file.arrayBuffer();
    } else {
      pdfBytes = await imageToPdfBytes(doc.file, doc.rotation);
    }

    const sourcePdf = await PDFDocument.load(pdfBytes);
    const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  return mergedPdf.save();
}

function detectBaseName(pdfName: string, zipName: string): { baseName: string; mismatch: boolean } {
  // Priority: extract from PDF comprobante name (e.g. PDF-DOC-E001-42720603116021.pdf -> E001-42720603116021)
  const pdfMatch = pdfName.match(/PDF-DOC-(.+?)\.pdf$/i) || pdfName.match(/(E\d+-\w+)/i);
  const zipMatch = zipName.match(/FACTURA(.+?)\.zip$/i) || zipName.match(/(E\d+-\w+)/i);

  const pdfBase = pdfMatch?.[1] || "";
  const zipBase = zipMatch?.[1] || "";

  if (pdfBase && zipBase) {
    return { baseName: pdfBase, mismatch: pdfBase !== zipBase };
  }

  return { baseName: pdfBase || zipBase || "", mismatch: false };
}

export default function ProcessEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [invoiceName, setInvoiceName] = useState("");
  const [status, setStatus] = useState("draft");

  // Base files
  const [comprobantePdf, setComprobantePdf] = useState<File | null>(null);
  const [sunatZip, setSunatZip] = useState<File | null>(null);
  const [detectedBase, setDetectedBase] = useState("");
  const [nameMismatch, setNameMismatch] = useState(false);

  // Support documents
  const [supportDocs, setSupportDocs] = useState<Record<CategoryKey, DocFile[]>>({
    guia_remision: [],
    orden_compra: [],
    partes_ingreso: [],
  });

  useEffect(() => {
    loadProcess();
  }, [id]);

  const loadProcess = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("processes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      toast.error("Proceso no encontrado");
      navigate("/");
      return;
    }

    setInvoiceName(data.invoice_name || "");
    setStatus(data.status);
    setLoading(false);
  };

  const handleComprobante = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setComprobantePdf(file);
    // Extract base name from PDF immediately
    const match = file.name.match(/PDF-DOC-(.+?)\.pdf$/i);
    if (match) {
      const baseName = match[1];
      setDetectedBase(baseName);
      if (!invoiceName) setInvoiceName(baseName);
    }
    if (sunatZip) checkMismatch(file.name, sunatZip.name);
  };

  const handleSunatZip = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setSunatZip(file);
    if (comprobantePdf) checkMismatch(comprobantePdf.name, file.name);
  };

  const checkMismatch = (pdfName: string, zipName: string) => {
    const { mismatch } = detectBaseName(pdfName, zipName);
    setNameMismatch(mismatch);
  };

  const handleAddFiles = useCallback(
    async (category: string, files: File[]) => {
      const newDocs: DocFile[] = await Promise.all(
        files.map(async (f) => ({
          id: generateFileId(),
          file: f,
          preview: await fileToPreview(f),
          rotation: 0,
        }))
      );

      setSupportDocs((prev) => ({
        ...prev,
        [category]: [...prev[category as CategoryKey], ...newDocs],
      }));
    },
    []
  );

  const handleRemoveFile = useCallback((category: string, fileId: string) => {
    setSupportDocs((prev) => ({
      ...prev,
      [category]: prev[category as CategoryKey].filter((f) => f.id !== fileId),
    }));
  }, []);

  const handleRotateFile = useCallback((category: string, fileId: string) => {
    setSupportDocs((prev) => ({
      ...prev,
      [category]: prev[category as CategoryKey].map((f) =>
        f.id === fileId ? { ...f, rotation: (f.rotation + 90) % 360 } : f
      ),
    }));
  }, []);

  const handleReorder = useCallback((category: string, newFiles: DocFile[]) => {
    setSupportDocs((prev) => ({ ...prev, [category]: newFiles }));
  }, []);

  const saveDraft = async () => {
    if (!id || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("processes")
      .update({ invoice_name: invoiceName || null })
      .eq("id", id);

    setSaving(false);
    if (error) {
      toast.error("Error al guardar");
    } else {
      toast.success("Borrador guardado");
    }
  };

  const canGenerate = () => {
    return (
      comprobantePdf &&
      sunatZip &&
      supportDocs.guia_remision.length > 0 &&
      supportDocs.orden_compra.length > 0 &&
      supportDocs.partes_ingreso.length > 0
    );
  };

  const generateZip = async () => {
    if (!canGenerate() || !id || !user) return;
    setGenerating(true);

    try {
      const baseName = invoiceName || detectedBase || "E001-000000";
      const prefix = `PDF-DOC-${baseName}`;

      // Read SUNAT ZIP contents
      const sunatZipData = await sunatZip!.arrayBuffer();
      const sunatContents = await JSZip.loadAsync(sunatZipData);

      // Find XML file
      let xmlFile: { name: string; data: Uint8Array } | null = null;
      for (const [name, entry] of Object.entries(sunatContents.files)) {
        if (name.toLowerCase().endsWith(".xml") && !entry.dir) {
          xmlFile = { name, data: await entry.async("uint8array") };
          break;
        }
      }

      // Create inner ZIP
      const innerZip = new JSZip();

      // Add merged PDFs for each category
      for (const cat of SUPPORT_CATEGORIES) {
        const docs = supportDocs[cat.key];
        if (docs.length > 0) {
          const mergedBytes = await mergeFilesToPdf(docs);
          innerZip.file(`${prefix} ${cat.pdfSuffix}.pdf`, mergedBytes);
        }
      }

      // Add XML copy
      if (xmlFile) {
        innerZip.file(xmlFile.name, xmlFile.data);
      }

      const innerZipBlob = await innerZip.generateAsync({ type: "uint8array" });

      // Create outer ZIP
      const outerZip = new JSZip();

      // Add original SUNAT ZIP contents (extracted files)
      for (const [name, entry] of Object.entries(sunatContents.files)) {
        if (!entry.dir) {
          outerZip.file(name, await entry.async("uint8array"));
        }
      }

      // Add comprobante PDF
      outerZip.file(comprobantePdf!.name, await comprobantePdf!.arrayBuffer());

      // Add inner ZIP
      outerZip.file(`${baseName}.zip`, innerZipBlob);

      const finalBlob = await outerZip.generateAsync({ type: "blob" });

      // Download
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prefix}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      // Mark as completed
      await supabase
        .from("processes")
        .update({ status: "completed", invoice_name: invoiceName || baseName })
        .eq("id", id);

      setStatus("completed");
      toast.success("¡ZIP generado y descargado!");
    } catch (err: any) {
      console.error(err);
      toast.error("Error generando el ZIP: " + (err.message || "Error desconocido"));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const missingBlocks = [
    !comprobantePdf && "PDF comprobante",
    !sunatZip && "ZIP SUNAT",
    supportDocs.guia_remision.length === 0 && "Guías de Remisión",
    supportDocs.orden_compra.length === 0 && "O.C.",
    supportDocs.partes_ingreso.length === 0 && "Partes de Ingreso",
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-display text-sm font-semibold text-foreground">
              {invoiceName || "Nuevo proceso"}
            </span>
            <Badge variant={status === "completed" ? "default" : "secondary"} className="text-[10px]">
              {status === "completed" ? "Completado" : "Borrador"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Guardar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {/* Invoice name */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos de la factura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Nombre base de la factura
              </label>
              <Input
                value={invoiceName}
                onChange={(e) => setInvoiceName(e.target.value)}
                placeholder="Ej: E001-42720603116021"
              />
              {detectedBase && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Detectado automáticamente: <strong>{detectedBase}</strong>
                </p>
              )}
              {nameMismatch && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  <p className="text-xs text-warning">
                    Los nombres del PDF y ZIP no coinciden. Verifica el nombre correcto.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comprobante PDF */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              PDF del Comprobante
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comprobantePdf ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{comprobantePdf.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComprobantePdf(null)}
                  className="text-destructive hover:text-destructive"
                >
                  Quitar
                </Button>
              </div>
            ) : (
              <FileUploadZone
                accept=".pdf"
                onFiles={handleComprobante}
                label="Subir PDF del comprobante"
                description="Solo archivos PDF"
              />
            )}
          </CardContent>
        </Card>

        {/* SUNAT ZIP */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4 text-primary" />
              ZIP de SUNAT
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sunatZip ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{sunatZip.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSunatZip(null)}
                  className="text-destructive hover:text-destructive"
                >
                  Quitar
                </Button>
              </div>
            ) : (
              <FileUploadZone
                accept=".zip"
                onFiles={handleSunatZip}
                label="Subir ZIP original de SUNAT"
                description="Solo archivos ZIP"
              />
            )}
          </CardContent>
        </Card>

        {/* Support document sections */}
        {SUPPORT_CATEGORIES.map((cat) => (
          <DocumentSection
            key={cat.key}
            title={cat.title}
            category={cat.key}
            files={supportDocs[cat.key]}
            onAddFiles={handleAddFiles}
            onRemoveFile={handleRemoveFile}
            onRotateFile={handleRotateFile}
            onReorder={handleReorder}
          />
        ))}

        {/* Preview / Generate */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vista previa y generación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Factura:</span>
                <span className="font-medium">{invoiceName || detectedBase || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">PDF Comprobante:</span>
                {comprobantePdf ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <span className="text-xs text-destructive">Falta</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ZIP SUNAT:</span>
                {sunatZip ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <span className="text-xs text-destructive">Falta</span>
                )}
              </div>
              {SUPPORT_CATEGORIES.map((cat) => (
                <div key={cat.key} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{cat.title}:</span>
                  {supportDocs[cat.key].length > 0 ? (
                    <span className="text-xs font-medium text-success">
                      {supportDocs[cat.key].length} doc{supportDocs[cat.key].length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-destructive">Falta</span>
                  )}
                </div>
              ))}
            </div>

            {/* Structure preview */}
            {canGenerate() && (
              <div className="rounded-md bg-card p-3 text-xs">
                <p className="mb-1 font-medium text-foreground">Estructura del ZIP final:</p>
                <pre className="whitespace-pre-wrap text-muted-foreground">
{`📦 PDF-DOC-${invoiceName || detectedBase}.zip
├── (archivos originales SUNAT)
├── ${comprobantePdf?.name}
└── 📦 ${invoiceName || detectedBase}.zip
    ├── PDF-DOC-${invoiceName || detectedBase} Guia_Remision.pdf
    ├── PDF-DOC-${invoiceName || detectedBase} O.C..pdf
    ├── PDF-DOC-${invoiceName || detectedBase} Partes_de_ingreso.pdf
    └── (XML original)`}
                </pre>
              </div>
            )}

            {missingBlocks.length > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-warning">
                  Falta: {missingBlocks.join(", ")}
                </p>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!canGenerate() || generating}
              onClick={generateZip}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Generar y descargar ZIP
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
