import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ChatReport, StoredReport } from '@/types';

// Lets the report screen tell the assistant which report is open, so answers can cite onion numbers.
const ChatReportContext = createContext<{ report: ChatReport | null; setReport: (r: ChatReport | null) => void }>({
  report: null,
  setReport: () => {},
});

export function ChatProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<ChatReport | null>(null);
  return <ChatReportContext.Provider value={{ report, setReport }}>{children}</ChatReportContext.Provider>;
}

export const useChatReport = () => useContext(ChatReportContext).report;

export function toChatReport({ meta, result }: StoredReport): ChatReport {
  return {
    batchId: meta.batchId,
    mode: result.mode,
    calibrated: result.calibrated,
    spec_name: result.spec_name,
    rules_version: result.rules_version,
    summary: result.summary,
    warnings: result.warnings,
    onions: result.onions.map(({ id, diameter_mm, category, reasons }) => ({ id, diameter_mm, category, reasons })),
  };
}

/** Call from a screen that shows a report; clears it again when the screen goes away. */
export function useShareReportWithChat(data: StoredReport | null | undefined) {
  const { setReport } = useContext(ChatReportContext);
  useEffect(() => {
    if (!data) return;
    setReport(toChatReport(data));
    return () => setReport(null);
  }, [data, setReport]);
}
