export type Category = 'GRADE_A' | 'URS' | 'REJECT';
export type LotVerdict = Category | 'NO_ONIONS';
export type ScanMode = 'batch' | 'single';

export interface Defect {
  type: string; // cuts | rotten | sprout
  confidence: number;
  box: number[];
}

export interface Onion {
  id: number;
  box: number[];
  diameter_mm: number | null;
  defects: Defect[];
  size_flag: 'undersized' | 'oversized' | null;
  category: Category;
  reasons: string[];
}

export interface Summary {
  total: number;
  grade_a: number;
  urs: number;
  reject: number;
  grade_a_pct: number;
  urs_pct: number;
  reject_pct: number;
  defect_counts: Record<string, number>;
  lot_verdict: LotVerdict;
}

export interface AnalysisResult {
  report_id: string;
  created_at: string;
  mode: ScanMode;
  image_width: number;
  image_height: number;
  calibrated: boolean;
  px_per_mm: number | null;
  onions: Onion[];
  summary: Summary;
  warnings: string[];
  model_id: string;
  rules_version: string;
  spec_name: string;
  report_hash: string;
  annotated_image_b64: string;
}

export interface ReportMeta {
  id: string;
  batchId: string;
  createdAt: string;
  mode: ScanMode;
  total: number;
  gradeAPct: number;
  ursPct: number;
  lotVerdict: LotVerdict;
  centreName: string;
  operatorName: string;
}

export interface StoredReport {
  meta: ReportMeta;
  result: AnalysisResult;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** What the assistant is told about the open report (the evidence image is left out). */
export interface ChatReport {
  batchId: string;
  mode: ScanMode;
  calibrated: boolean;
  spec_name: string;
  rules_version: string;
  summary: Summary;
  warnings: string[];
  onions: Pick<Onion, 'id' | 'diameter_mm' | 'category' | 'reasons'>[];
}
