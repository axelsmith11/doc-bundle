import { useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Loader2, Trash2, Download,
  FileText, CalendarIcon, Database,
} from "lucide-react";
import masterDataJson from "@/data/masterData.json";

// ─── Types ───
interface OCRow {
  item: number; carro: number; tn: number; oc: string;
  fechaDate: Date; fechaTexto: string; codigo: string; descripcion: string;
  umb: string; cantidad: number;
  undCajaMaster: number | string; cantCajasMaster: number | string | null;
  cantPaletas: string; prodConVenc: string | number; prodNuevo: string | number;
  ean13: string | number; altoCm: number | string; anchoCm: number | string;
  largoCm: number | string; volumenCm3: number | string; pesoKg: number | string;
  ean14: string | number;
}

interface MasterEntry {
  undCajaMaster: number | null; cantPaletas: number | null;
  prodConVenc: number | null; prodNuevo: number | null; ean13: number | null;
  altoCm: number | null; anchoCm: number | null; largoCm: number | null;
  volumenCm3: number | null; pesoKg: number | null; ean14: number | null;
}

// ─── Helpers ───
function toNumber3(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  let s = String(v).trim().replace(/\u00A0/g, "");
  const hasComma = /,/.test(s), hasDot = /\./.test(s);
  if (hasComma && !hasDot) { s = s.replace(/\./g, "").replace(",", "."); }
  else if (!hasComma && hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) { s = s.replace(/\./g, ""); }
  else { s = s.replace(/,/g, ""); }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
function fmt3(v: unknown) { const n = toNumber3(v); return n != null ? n.toFixed(3) : ""; }
function fmt2(v: unknown) { const n = toNumber3(v); return n != null ? n.toFixed(2) : ""; }
function fmtMiles0(v: unknown) { const n = Number(v); return Number.isFinite(n) ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""; }
function numOrEmpty(v: unknown) { if (v === 0 || v === "0") return 0; const n = Number(v); return Number.isFinite(n) ? n : undefined; }
function decOrEmpty(v: unknown) { return toNumber3(v) ?? undefined; }
function strOrEmpty(v: unknown) { if (v == null) return undefined; const s = String(v).trim(); return s || undefined; }

// ─── Embedded master ───
const MASTER = masterDataJson as Record<string, MasterEntry>;
const MASTER_SIZE = Object.keys(MASTER).length;

// ─── PDF parsing ───
async function readPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return text;
}

function extractRows(text: string, fechaDate: Date, fechaTexto: string, start: number) {
  const pedido = /Pedido N[°º]\s+(\d+)/i.exec(text);
  const oc = pedido?.[1] ?? "";
  const re = /(\d{5})\s+(\d+)\s+([\s\S]*?)\s+(\d+\.\d{3})\s+UN/gi;
  const rows: OCRow[] = [];
  let m: RegExpExecArray | null, c = start;

  while ((m = re.exec(text)) !== null) {
    const codigo = String(Number(m[2]));
    const desc = m[3].replace(/\s+U\.FIJA.*?PALETIZ\./i, "").replace(/\s+/g, " ").trim();
    const cantidad = Math.round(parseFloat(m[4]));
    const src = MASTER[codigo];

    let undCM: number | string = "", ccm: number | string | null = "", cp = "", pv: string | number = "";
    let pn: string | number = "", e13: string | number = "", e14: string | number = "";
    let aC: number | string = "", anC: number | string = "", lC: number | string = "";
    let vC: number | string = "", pK: number | string = "";

    if (src) {
      undCM = src.undCajaMaster ?? "";
      cp = src.cantPaletas != null ? String(src.cantPaletas) : "";
      pv = src.prodConVenc ?? ""; pn = src.prodNuevo ?? "";
      e13 = src.ean13 ?? ""; e14 = src.ean14 ?? "";
      aC = src.altoCm ?? ""; anC = src.anchoCm ?? ""; lC = src.largoCm ?? "";
      vC = src.volumenCm3 ?? ""; pK = src.pesoKg ?? "";
      const u = Number(undCM);
      ccm = u === 0 ? 0 : (Number.isFinite(u) && u > 0 ? Math.trunc(cantidad / u) : null);
    }

    rows.push({
      item: c++, carro: 1, tn: 2, oc, fechaDate, fechaTexto, codigo, descripcion: desc,
      umb: "UN", cantidad, undCajaMaster: undCM, cantCajasMaster: ccm, cantPaletas: cp,
      prodConVenc: pv, prodNuevo: pn, ean13: e13, altoCm: aC, anchoCm: anC, largoCm: lC,
      volumenCm3: vC, pesoKg: pK, ean14: e14,
    });
  }
  return { oc, rows };
}

// ─── Excel export ───
async function generarExcel(rows: OCRow[]) {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("OCs", { views: [{ state: "frozen" as const, ySplit: 1 }] });
  const G = "FF007500", W = "FFFFFFFF";

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

  const hdr = ws.getRow(1);
  hdr.height = 30;
  hdr.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: G } };
    cell.font = { bold: true, color: { argb: W } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });

  for (const r of rows) {
    ws.addRow({
      item: numOrEmpty(r.item), carro: numOrEmpty(1), tn: numOrEmpty(2),
      oc: numOrEmpty(r.oc), fecha: r.fechaDate, codigo: numOrEmpty(r.codigo),
      descripcion: strOrEmpty(r.descripcion), umb: "UN", cantidad: numOrEmpty(r.cantidad),
      undCajaMaster: numOrEmpty(r.undCajaMaster), cantCajasMaster: numOrEmpty(r.cantCajasMaster),
      cantPaletas: numOrEmpty(r.cantPaletas), prodConVenc: numOrEmpty(r.prodConVenc),
      prodNuevo: numOrEmpty(r.prodNuevo), ean13: numOrEmpty(r.ean13),
      altoCm: decOrEmpty(r.altoCm), anchoCm: decOrEmpty(r.anchoCm), largoCm: decOrEmpty(r.largoCm),
      volumenCm3: numOrEmpty(r.volumenCm3), pesoKg: decOrEmpty(r.pesoKg), ean14: numOrEmpty(r.ean14),
    });
  }

  ws.getColumn("fecha").numFmt = "mm/dd/yyyy";
  ws.getColumn("cantidad").numFmt = "0";
  ws.getColumn("undCajaMaster").numFmt = "0";
  ws.getColumn("cantCajasMaster").numFmt = "0";
  ["altoCm","anchoCm","largoCm"].forEach(c => ws.getColumn(c).numFmt = "0.000");
  ws.getColumn("volumenCm3").numFmt = "#,##0";
  ws.getColumn("pesoKg").numFmt = "0.00";
  ws.getColumn("ean13").numFmt = "0";
  ws.getColumn("ean14").numFmt = "0";

  const last = ws.lastRow?.number ?? 1;
  const cF = ws.getColumn("fecha").number;
  const ra = new Set([ws.getColumn("cantidad").number, ws.getColumn("codigo").number,
    ws.getColumn("undCajaMaster").number, ws.getColumn("cantCajasMaster").number, ws.getColumn("volumenCm3").number]);

  for (let r = 2; r <= last; r++) {
    const row = ws.getRow(r);
    row.height = 20;
    row.eachCell((cell, c) => {
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = c === cF
        ? { vertical: "middle", horizontal: "center" }
        : ra.has(c) ? { vertical: "middle", horizontal: "right" }
        : { vertical: "middle", horizontal: "left", wrapText: true };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `OCs_${Date.now()}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Component ───
export default function Citas() {
  const [rows, setRows] = useState<OCRow[]>([]);
  const [ocs, setOcs] = useState<Set<string>>(new Set());
  const [fecha, setFecha] = useState<Date>();
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleProcess = useCallback(async () => {
    const files = Array.from(pdfInputRef.current?.files || []);
    if (!files.length) { toast.error("Selecciona al menos un PDF."); return; }
    if (!fecha) { toast.error("Selecciona la fecha de despacho."); return; }

    const fechaTexto = `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;

    setProcessing(true);
    try {
      const allRows: OCRow[] = [];
      const allOcs = new Set<string>();
      let counter = 1;

      for (let i = 0; i < files.length; i++) {
        setStatus(`Leyendo PDF ${i + 1}/${files.length}…`);
        const text = await readPdfText(files[i]);
        const { oc, rows: parsed } = extractRows(text, fecha, fechaTexto, counter);
        if (oc) allOcs.add(oc);
        allRows.push(...parsed);
        counter += parsed.length;
      }

      setRows(allRows);
      setOcs(allOcs);
      setStatus(allRows.length
        ? `${allRows.length} ítems extraídos de ${allOcs.size} OC(s)`
        : "No se encontraron ítems en los PDFs.");
    } catch (e) {
      console.error(e);
      toast.error("Error procesando los PDFs.");
      setStatus("");
    } finally {
      setProcessing(false);
    }
  }, [fecha]);

  const handleQtyChange = useCallback((idx: number, value: string) => {
    setRows((prev) => {
      const u = [...prev];
      const r = { ...u[idx] };
      const num = parseInt(value, 10);
      r.cantidad = Number.isFinite(num) && num >= 0 ? num : 0;
      const upc = Number(r.undCajaMaster);
      r.cantCajasMaster = upc === 0 ? 0 : (Number.isFinite(upc) && upc > 0 ? Math.trunc(r.cantidad / upc) : null);
      u[idx] = r;
      return u;
    });
  }, []);

  const handleDelete = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, item: i + 1 })));
  }, []);

  const handleExport = useCallback(async () => {
    if (!rows.length) return;
    setExporting(true);
    try { await generarExcel(rows); toast.success("Excel descargado"); }
    catch { toast.error("Error generando Excel"); }
    finally { setExporting(false); }
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-4">
            {/* Date picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fecha de despacho</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !fecha && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fecha ? format(fecha, "dd/MM/yyyy") : "Seleccionar…"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fecha}
                    onSelect={setFecha}
                    locale={es}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* PDF upload */}
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
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

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleProcess} disabled={processing}>
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Procesar
              </Button>
              <Button onClick={handleExport} disabled={!rows.length || exporting} variant="secondary">
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Excel
              </Button>
            </div>
          </div>

          {/* Info bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Database className="mr-1 h-3 w-3" />
              {MASTER_SIZE} productos
            </Badge>
            {status && (
              <span className="text-xs text-muted-foreground">{status}</span>
            )}
            {rows.length > 0 && (
              <>
                <Badge variant="secondary" className="text-xs">OCs: {ocs.size}</Badge>
                <Badge variant="secondary" className="text-xs">Ítems: {rows.length}</Badge>
                <Badge variant="secondary" className="text-xs">
                  Total: {rows.reduce((a, r) => a + (Number(r.cantidad) || 0), 0)} un.
                </Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr>
                {[
                  "#", "Carro", "TN", "N° OC", "Fecha",
                  "Código", "Descripción", "", "UMB", "Cant.",
                  "Und/Caja", "Cajas", "Paletas",
                  "Venc.", "Nuevo", "EAN 13",
                  "Alto", "Ancho", "Largo", "Vol CM³", "Peso KG", "EAN 14"
                ].map((h, i) => (
                  <th key={i} className="whitespace-nowrap border border-border bg-[hsl(120,100%,23%)] px-2 py-2 text-center text-xs font-bold text-white">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="border border-border px-2 py-1.5 text-center text-xs">{r.item}</td>
                  <td className="border border-border px-2 py-1.5 text-center text-xs">{r.carro}</td>
                  <td className="border border-border px-2 py-1.5 text-center text-xs">{r.tn}</td>
                  <td className="border border-border px-2 py-1.5 text-xs">{r.oc}</td>
                  <td className="border border-border px-2 py-1.5 text-center text-xs">{r.fechaTexto}</td>
                  <td className="border border-border px-2 py-1.5 text-right text-xs">{r.codigo}</td>
                  <td className="border border-border px-2 py-1.5 text-xs">{r.descripcion}</td>
                  <td className="border border-border px-1 py-1 text-center">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                  <td className="border border-border px-2 py-1.5 text-center text-xs">{r.umb}</td>
                  <td className="border border-border px-1 py-1">
                    <Input type="number" min={0} step={1} value={r.cantidad}
                      onChange={(e) => handleQtyChange(idx, e.target.value)}
                      className="h-7 w-16 text-right text-xs" />
                  </td>
                  <td className="border border-border px-2 py-1.5 text-right text-xs">{r.undCajaMaster ?? ""}</td>
                  <td className="border border-border px-2 py-1.5 text-right text-xs">
                    {r.cantCajasMaster != null && r.cantCajasMaster !== "" ? String(r.cantCajasMaster) : ""}
                  </td>
                  <td className="border border-border px-2 py-1.5 text-xs">{r.cantPaletas}</td>
                  <td className="border border-border px-2 py-1.5 text-center text-xs">{String(r.prodConVenc)}</td>
                  <td className="border border-border px-2 py-1.5 text-center text-xs">{String(r.prodNuevo)}</td>
                  <td className="border border-border px-2 py-1.5 text-xs">{String(r.ean13)}</td>
                  <td className="border border-border px-2 py-1.5 text-right text-xs">{fmt3(r.altoCm)}</td>
                  <td className="border border-border px-2 py-1.5 text-right text-xs">{fmt3(r.anchoCm)}</td>
                  <td className="border border-border px-2 py-1.5 text-right text-xs">{fmt3(r.largoCm)}</td>
                  <td className="border border-border px-2 py-1.5 text-right text-xs">{fmtMiles0(r.volumenCm3)}</td>
                  <td className="border border-border px-2 py-1.5 text-right text-xs">{fmt2(r.pesoKg)}</td>
                  <td className="border border-border px-2 py-1.5 text-xs">{String(r.ean14)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !processing && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Selecciona fecha, sube PDFs de OC y haz clic en Procesar.
          </p>
        </div>
      )}
    </div>
  );
}
