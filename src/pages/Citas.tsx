import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Download,
  Database,
  CalendarDays,
  FileText,
} from "lucide-react";

// ─── Types ───
interface OCRow {
  item: number;
  carro: number;
  tn: number;
  oc: string;
  fechaDate: Date;
  fechaTexto: string;
  codigo: string;
  descripcion: string;
  umb: string;
  cantidad: number;
  undCajaMaster: number | string;
  cantCajasMaster: number | string | null;
  cantPaletas: string;
  prodConVenc: string | number;
  prodNuevo: string | number;
  ean13: string | number;
  altoCm: number | string;
  anchoCm: number | string;
  largoCm: number | string;
  volumenCm3: number | string;
  pesoKg: number | string;
  ean14: string | number;
}

interface MasterData {
  loaded: boolean;
  rows: Record<string, unknown>[];
  headerMap: Record<string, string>;
  map: Map<string, Record<string, unknown>>;
}

// ─── Helpers ───
function norm(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber3(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  let s = String(v).trim().replace(/\u00A0/g, "");
  const hasComma = /,/.test(s);
  const hasDot = /\./.test(s);
  if (hasComma && !hasDot) {
    s = s.replace(/\./g, "");
    s = s.replace(",", ".");
  } else if (!hasComma && hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function fmt3(v: unknown): string {
  const n = toNumber3(v);
  return Number.isFinite(n) ? n!.toFixed(3) : "";
}
function fmt2(v: unknown): string {
  const n = toNumber3(v);
  return Number.isFinite(n) ? n!.toFixed(2) : "";
}
function fmtMiles0(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function valOr(current: unknown, fallback: unknown): unknown {
  if (current === 0 || current === "0") return 0;
  return current || fallback || "";
}

function numOrEmpty(v: unknown): number | undefined {
  if (v === 0 || v === "0") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function decOrEmpty(v: unknown): number | undefined {
  const n = toNumber3(v);
  return Number.isFinite(n) ? n : undefined;
}
function strOrEmpty(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

const PAD_EPOCH = new Date(Date.UTC(1899, 11, 30));
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function excelSerialToDate(serial: number): Date {
  const ms = Math.round(serial) * MS_PER_DAY;
  return new Date(PAD_EPOCH.getTime() + ms);
}

// ─── Master helpers ───
const MASTER_DB_KEY = "oc_master_rows_v1";

function buildMasterIndex(rows: Record<string, unknown>[]): MasterData {
  const data: MasterData = { loaded: false, rows: rows || [], headerMap: {}, map: new Map() };
  if (!data.rows.length) return data;

  const first = data.rows[0];
  Object.keys(first).forEach((k) => { data.headerMap[norm(k)] = k; });

  const pick = (row: Record<string, unknown>, humanName: string) => {
    const k = data.headerMap[norm(humanName)];
    return k ? row[k] : "";
  };

  for (const row of data.rows) {
    const code = String(
      pick(row, "CODIGO") ||
      pick(row, "CODIGO SAP") ||
      pick(row, "CODIGO TAI LOY SAP (IGUAL A OC)") ||
      pick(row, "CODIGO TAI LOY SAP") ||
      row["codigo"] || row["COD"] || ""
    ).trim();
    if (!code) continue;
    data.map.set(code, row);
  }

  data.loaded = data.map.size > 0;
  return data;
}

function saveMasterToStorage(rows: Record<string, unknown>[]) {
  try {
    localStorage.setItem(MASTER_DB_KEY, JSON.stringify(rows));
  } catch {
    // If too large, silently fail
  }
}

function loadMasterFromStorage(): Record<string, unknown>[] | null {
  try {
    const raw = localStorage.getItem(MASTER_DB_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length ? data : null;
  } catch {
    return null;
  }
}

// ─── PDF parsing ───
async function readPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it: any) => it.str).join(" ");
    text += pageText + "\n";
  }
  return text;
}

function extractRowsFromText(
  text: string,
  fechaDate: Date,
  fechaTexto: string,
  startItem: number
): { oc: string; rows: OCRow[] } {
  const pedidoMatch = /Pedido N[°º]\s+(\d+)/i.exec(text);
  const oc = pedidoMatch ? pedidoMatch[1] : "";
  const re = /(\d{5})\s+(\d+)\s+([\s\S]*?)\s+(\d+\.\d{3})\s+UN/gi;

  const rows: OCRow[] = [];
  let m: RegExpExecArray | null;
  let counter = startItem;
  while ((m = re.exec(text)) !== null) {
    const codigo = String(Number(m[2]));
    const descripcion = m[3]
      .replace(/\s+U\.FIJA.*?PALETIZ\./i, "")
      .replace(/\s+/g, " ")
      .trim();
    const cantidad = Math.round(parseFloat(m[4]));

    rows.push({
      item: counter,
      carro: 1,
      tn: 2,
      oc,
      fechaDate,
      fechaTexto,
      codigo,
      descripcion,
      umb: "UN",
      cantidad,
      undCajaMaster: "", cantCajasMaster: "", cantPaletas: "",
      prodConVenc: "", prodNuevo: "", ean13: "",
      altoCm: "", anchoCm: "", largoCm: "",
      volumenCm3: "", pesoKg: "", ean14: "",
    });
    counter++;
  }
  return { oc, rows };
}

function autoRellenarDesdeMaestro(rows: OCRow[], masterData: MasterData): OCRow[] {
  if (!masterData.loaded) return rows;

  const get = (row: Record<string, unknown>, human: string) => {
    const k = masterData.headerMap[norm(human)];
    if (!k) return "";
    const val = row[k];
    if (val === 0 || val === "0") return 0;
    return val ?? "";
  };

  return rows.map((r) => {
    const clave = String(r.codigo).trim();
    const src = masterData.map.get(clave);
    if (!src) return r;

    const updated = { ...r };
    const undCaja = get(src, "UNIDADES POR CAJA MASTER");
    updated.undCajaMaster = Number.isFinite(Number(undCaja)) ? parseInt(String(undCaja), 10) : "";
    updated.cantPaletas = String(get(src, "CANT. PALETAS"));
    updated.prodConVenc = valOr(get(src, "PRODUCTO CON VENCIMIENTO (NO = 0/ SI =1)"), get(src, "PRODUCTO CON VENCIMIENTO")) as string | number;
    updated.prodNuevo = valOr(get(src, "¿PRODUCTO NUEVO? (NO = 0/ SI =1)"), get(src, "PRODUCTO NUEVO")) as string | number;
    updated.ean13 = toNumber3(valOr(get(src, "EAN 13 UMB"), valOr(get(src, "EAN13"), get(src, "EAN 13")))) ?? "";
    updated.ean14 = toNumber3(valOr(get(src, "EAN 14 CAJA"), get(src, "EAN14"))) ?? "";
    updated.altoCm = toNumber3(valOr(get(src, "Alto Caja CM"), get(src, "ALTO CAJA CM"))) ?? "";
    updated.anchoCm = toNumber3(valOr(get(src, "Ancho Caja CM"), get(src, "ANCHO CAJA CM"))) ?? "";
    updated.largoCm = toNumber3(valOr(get(src, "Largo Caja CM"), get(src, "LARGO CAJA CM"))) ?? "";
    updated.volumenCm3 = toNumber3(valOr(get(src, "VOLUMEN POR CAJA CM3"), get(src, "VOLUMEN CAJA CM3"))) ?? "";
    updated.pesoKg = toNumber3(valOr(get(src, "PESO POR CAJA KG"), get(src, "PESO CAJA KG"))) ?? "";

    const upc = Number(updated.undCajaMaster);
    const cant = Number(updated.cantidad);
    if (upc === 0) updated.cantCajasMaster = 0;
    else if (Number.isFinite(upc) && upc > 0 && Number.isFinite(cant)) updated.cantCajasMaster = Math.trunc(cant / upc);
    else updated.cantCajasMaster = null;

    return updated;
  });
}

// ─── Excel export ───
async function generarExcel(rows: OCRow[]) {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("OCs", { views: [{ state: "frozen" as const, ySplit: 1 }] });

  const GREEN = "FF007500";
  const WHITE = "FFFFFFFF";

  ws.columns = [
    { header: "# ITEM", key: "item", width: 8 },
    { header: "Carro", key: "carro", width: 8 },
    { header: "TN", key: "tn", width: 6 },
    { header: "NUMERO DE OC", key: "oc", width: 16 },
    { header: "FECHA DE DESPACHO\n(mm/dd/aaaa)", key: "fecha", width: 18 },
    { header: "CODIGO TAI LOY\nSAP (IGUAL A OC)", key: "codigo", width: 20 },
    { header: "DESCRIPCION\nPRODUCTO (IGUAL A LA OC)", key: "descripcion", width: 42 },
    { header: "UMB", key: "umb", width: 6 },
    { header: "CANTIDAD", key: "cantidad", width: 10 },
    { header: "UNIDADES POR\nCAJA MASTER", key: "undCajaMaster", width: 18 },
    { header: "CANT. CAJAS\nMASTER", key: "cantCajasMaster", width: 16 },
    { header: "CANT. PALETAS", key: "cantPaletas", width: 14 },
    { header: "PRODUCTO CON\nVENCIMIENTO\n(NO = 0/ SI =1)", key: "prodConVenc", width: 26 },
    { header: "¿PRODUCTO NUEVO?\n(NO = 0/ SI =1)", key: "prodNuevo", width: 22 },
    { header: "EAN 13 UMB", key: "ean13", width: 16 },
    { header: "Alto Caja\nCM", key: "altoCm", width: 12 },
    { header: "Ancho Caja\nCM", key: "anchoCm", width: 12 },
    { header: "Largo Caja\nCM", key: "largoCm", width: 12 },
    { header: "VOLUMEN POR\nCAJA CM3", key: "volumenCm3", width: 16 },
    { header: "PESO POR\nCAJA KG", key: "pesoKg", width: 14 },
    { header: "EAN 14 CAJA", key: "ean14", width: 16 },
  ];

  const header = ws.getRow(1);
  header.height = 30;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });

  for (const r of rows) {
    ws.addRow({
      item: numOrEmpty(r.item),
      carro: numOrEmpty(1),
      tn: numOrEmpty(2),
      oc: numOrEmpty(r.oc),
      fecha: r.fechaDate,
      codigo: numOrEmpty(r.codigo),
      descripcion: strOrEmpty(r.descripcion),
      umb: "UN",
      cantidad: numOrEmpty(r.cantidad),
      undCajaMaster: numOrEmpty(r.undCajaMaster),
      cantCajasMaster: numOrEmpty(r.cantCajasMaster),
      cantPaletas: numOrEmpty(r.cantPaletas),
      prodConVenc: numOrEmpty(r.prodConVenc),
      prodNuevo: numOrEmpty(r.prodNuevo),
      ean13: numOrEmpty(r.ean13),
      altoCm: decOrEmpty(r.altoCm),
      anchoCm: decOrEmpty(r.anchoCm),
      largoCm: decOrEmpty(r.largoCm),
      volumenCm3: numOrEmpty(r.volumenCm3),
      pesoKg: decOrEmpty(r.pesoKg),
      ean14: numOrEmpty(r.ean14),
    });
  }

  ws.getColumn("fecha").numFmt = "mm/dd/yyyy";
  ws.getColumn("cantidad").numFmt = "0";
  ws.getColumn("undCajaMaster").numFmt = "0";
  ws.getColumn("cantCajasMaster").numFmt = "0";
  ws.getColumn("altoCm").numFmt = "0.000";
  ws.getColumn("anchoCm").numFmt = "0.000";
  ws.getColumn("largoCm").numFmt = "0.000";
  ws.getColumn("volumenCm3").numFmt = "#,##0";
  ws.getColumn("pesoKg").numFmt = "0.00";
  ws.getColumn("ean13").numFmt = "0";
  ws.getColumn("ean14").numFmt = "0";

  const last = ws.lastRow?.number ?? 1;
  const colFecha = ws.getColumn("fecha").number;
  const rightAligned = new Set([
    ws.getColumn("cantidad").number,
    ws.getColumn("codigo").number,
    ws.getColumn("undCajaMaster").number,
    ws.getColumn("cantCajasMaster").number,
    ws.getColumn("volumenCm3").number,
  ]);

  for (let r = 2; r <= last; r++) {
    const row = ws.getRow(r);
    row.height = 20;
    row.eachCell((cell, c) => {
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      if (c === colFecha) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (rightAligned.has(c)) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      }
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `OCs_${Date.now()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Component ───
export default function Citas() {
  const [master, setMaster] = useState<MasterData>({ loaded: false, rows: [], headerMap: {}, map: new Map() });
  const [rows, setRows] = useState<OCRow[]>([]);
  const [ocs, setOcs] = useState<Set<string>>(new Set());
  const [fechaSerial, setFechaSerial] = useState("");
  const [fechaPicker, setFechaPicker] = useState("");
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);

  // Load master from localStorage on mount
  useEffect(() => {
    const stored = loadMasterFromStorage();
    if (stored) {
      const data = buildMasterIndex(stored);
      setMaster(data);
      setStatus(`Maestro cargado (${data.map.size} códigos).`);
    } else {
      setStatus("Carga tu Excel maestro (solo la primera vez).");
    }
  }, []);

  const handleMasterUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setStatus("Cargando maestro…");
      const XLSX = await import("xlsx");
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const jsonRows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
      if (!jsonRows.length) throw new Error("El maestro está vacío.");

      const data = buildMasterIndex(jsonRows);
      saveMasterToStorage(jsonRows);
      setMaster(data);

      if (rows.length && data.loaded) {
        const updated = autoRellenarDesdeMaestro(rows, data);
        setRows(updated);
      }

      setStatus(data.loaded ? `Maestro cargado y guardado (${data.map.size} códigos).` : "No se detectaron códigos en el maestro.");
    } catch (err) {
      console.error(err);
      setStatus("No se pudo leer el maestro. Verifica el archivo.");
    }
  }, [rows]);

  const handleProcessPdfs = useCallback(async () => {
    const files = Array.from(pdfInputRef.current?.files || []);
    if (!files.length) { setStatus("Sube uno o varios PDF primero."); return; }

    let fechaDate: Date, fechaTexto: string;
    if (fechaSerial.trim()) {
      const serial = Number(fechaSerial.trim());
      if (!Number.isFinite(serial)) { setStatus("El serial debe ser un número."); return; }
      fechaDate = excelSerialToDate(serial);
      fechaTexto = `${String(fechaDate.getUTCDate()).padStart(2, "0")}/${String(fechaDate.getUTCMonth() + 1).padStart(2, "0")}/${fechaDate.getFullYear()}`;
    } else if (fechaPicker.trim()) {
      const d = new Date(fechaPicker.trim() + "T00:00:00Z");
      if (isNaN(d.getTime())) { setStatus("Fecha inválida."); return; }
      fechaDate = d;
      fechaTexto = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    } else {
      setStatus("Elige una fecha (serial o date)."); return;
    }

    setProcessing(true);
    try {
      const allRows: OCRow[] = [];
      const allOcs = new Set<string>();
      let counter = 1;

      for (let i = 0; i < files.length; i++) {
        setStatus(`Leyendo PDF ${i + 1}/${files.length}… (${files[i].name})`);
        const text = await readPdfText(files[i]);
        const { oc, rows: parsed } = extractRowsFromText(text, fechaDate!, fechaTexto!, counter);
        if (oc) allOcs.add(oc);
        allRows.push(...parsed);
        counter += parsed.length;
      }

      let finalRows = allRows;
      if (master.loaded) finalRows = autoRellenarDesdeMaestro(allRows, master);

      setRows(finalRows);
      setOcs(allOcs);
      setStatus(finalRows.length
        ? `Listo. ${finalRows.length} ítems de ${allOcs.size} OC(s).`
        : "No se encontraron ítems.");
    } catch (e) {
      console.error(e);
      setStatus("Error procesando los PDF(s).");
    } finally {
      setProcessing(false);
    }
  }, [fechaSerial, fechaPicker, master]);

  const handleQuantityChange = useCallback((idx: number, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[idx] };
      const num = parseInt(value, 10);
      row.cantidad = Number.isFinite(num) && num >= 0 ? num : 0;

      const upc = Number(row.undCajaMaster);
      if (upc === 0) row.cantCajasMaster = 0;
      else if (Number.isFinite(upc) && upc > 0) row.cantCajasMaster = Math.trunc(row.cantidad / upc);
      else row.cantCajasMaster = null;

      updated[idx] = row;
      return updated;
    });
  }, []);

  const handleDeleteRow = useCallback((idx: number) => {
    setRows((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      return updated.map((r, i) => ({ ...r, item: i + 1 }));
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (!rows.length) return;
    setExporting(true);
    try {
      await generarExcel(rows);
      toast.success("Excel generado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("Error generando Excel");
    } finally {
      setExporting(false);
    }
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Status */}
      {status && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          {status}
        </div>
      )}

      {/* Controls */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Master upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              Excel Maestro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {master.loaded
                ? `✓ ${master.map.size} códigos cargados`
                : "Sube tu archivo .xls/.xlsx maestro"}
            </p>
            <Input
              ref={masterInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleMasterUpload}
              className="text-sm"
            />
          </CardContent>
        </Card>

        {/* Date + PDF upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              Fecha de despacho
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Serial Excel</label>
                <Input
                  type="number"
                  placeholder="Ej: 45800"
                  value={fechaSerial}
                  onChange={(e) => { setFechaSerial(e.target.value); if (e.target.value) setFechaPicker(""); }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">o Fecha</label>
                <Input
                  type="date"
                  value={fechaPicker}
                  onChange={(e) => { setFechaPicker(e.target.value); if (e.target.value) setFechaSerial(""); }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PDF upload + actions */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              PDFs de Órdenes de Compra
            </label>
            <Input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="text-sm"
            />
          </div>
          <Button onClick={handleProcessPdfs} disabled={processing}>
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Procesar PDFs
          </Button>
          <Button onClick={handleExport} disabled={!rows.length || exporting} variant="secondary">
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Exportar Excel
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            <FileSpreadsheet className="mr-1 h-3 w-3" />
            {master.loaded ? `Maestro OK (${master.map.size})` : "Sin maestro"}
          </Badge>
          <Badge variant="secondary">OCs: {ocs.size}</Badge>
          <Badge variant="secondary">Ítems: {rows.length}</Badge>
          <Badge variant="secondary">
            Cantidad total: {rows.reduce((a, r) => a + (Number(r.cantidad) || 0), 0)}
          </Badge>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr>
                {[
                  "# ITEM", "Carro", "TN", "N° OC", "Fecha despacho",
                  "Código SAP", "Descripción", "Acciones", "UMB", "Cantidad",
                  "Und/Caja Master", "Cant. Cajas", "Paletas",
                  "Vencimiento\n(0/1)", "¿Nuevo?\n(0/1)", "EAN 13",
                  "Alto CM", "Ancho CM", "Largo CM", "Vol CM³", "Peso KG", "EAN 14"
                ].map((h, i) => (
                  <th
                    key={i}
                    className="whitespace-pre-line border border-border bg-[hsl(120,100%,23%)] px-2 py-2 text-center text-xs font-bold text-white"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="border border-border px-2 py-1.5 text-center">{r.item}</td>
                  <td className="border border-border px-2 py-1.5 text-center">{r.carro}</td>
                  <td className="border border-border px-2 py-1.5 text-center">{r.tn}</td>
                  <td className="border border-border px-2 py-1.5">{r.oc}</td>
                  <td className="border border-border px-2 py-1.5 text-center">{r.fechaTexto}</td>
                  <td className="border border-border px-2 py-1.5 text-right">{r.codigo}</td>
                  <td className="border border-border px-2 py-1.5">{r.descripcion}</td>
                  <td className="border border-border px-2 py-1.5 text-center">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleDeleteRow(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                  <td className="border border-border px-2 py-1.5 text-center">{r.umb}</td>
                  <td className="border border-border px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={r.cantidad}
                      onChange={(e) => handleQuantityChange(idx, e.target.value)}
                      className="h-7 w-20 text-right text-xs"
                    />
                  </td>
                  <td className="border border-border px-2 py-1.5 text-right">{r.undCajaMaster ?? ""}</td>
                  <td className="border border-border px-2 py-1.5 text-right">
                    {r.cantCajasMaster !== null && r.cantCajasMaster !== "" ? String(r.cantCajasMaster) : ""}
                  </td>
                  <td className="border border-border px-2 py-1.5">{r.cantPaletas}</td>
                  <td className="border border-border px-2 py-1.5 text-center">{String(r.prodConVenc)}</td>
                  <td className="border border-border px-2 py-1.5 text-center">{String(r.prodNuevo)}</td>
                  <td className="border border-border px-2 py-1.5">{String(r.ean13)}</td>
                  <td className="border border-border px-2 py-1.5 text-right">{fmt3(r.altoCm)}</td>
                  <td className="border border-border px-2 py-1.5 text-right">{fmt3(r.anchoCm)}</td>
                  <td className="border border-border px-2 py-1.5 text-right">{fmt3(r.largoCm)}</td>
                  <td className="border border-border px-2 py-1.5 text-right">{fmtMiles0(r.volumenCm3)}</td>
                  <td className="border border-border px-2 py-1.5 text-right">{fmt2(r.pesoKg)}</td>
                  <td className="border border-border px-2 py-1.5">{String(r.ean14)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && !processing && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Sube PDFs de órdenes de compra y procésalos para ver la tabla aquí.
          </p>
        </div>
      )}
    </div>
  );
}
