export type ExportTable = { heading?: string; columns: string[]; widths: number[]; rows: string[][] };
export type ExportDocument = { filename: string; title: string; subtitle: string; notes: string[]; tables: ExportTable[] };
