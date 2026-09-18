import React, { useEffect, useState } from 'react';
import { PdfComparator } from './PdfComparator';

interface ParsedBlock {
  id: string;
  type: 'text' | 'heading' | 'table';
  markdown: string;
  plainValue: string;
  html?: string;
  page: number;
  bbox: { x: number; y: number; width: number; height: number };
  lineBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
}

interface ComparisonPayload {
  success: boolean;
  documentId: number;
  fileName: string;
  fileUrl: string;
  markdown: string;
  blocks: ParsedBlock[];
  pageDimensions: Record<number, { width: number; height: number }>;
}

const COLORS = {
  chatBoxBg: '#0f0f14',
  chatBoxBorder: '#2a2a35',
  sidebarBorder: '#2a2a35',
  sidebarTitle: '#8b8b9a',
  sidebarText: '#c5c5d0',
  mainTitle: '#ffffff',
  assistantBubbleBg: '#13131a',
  newChatBtn: '#22c55e',
  newChatBtnText: '#ffffff',
};

const ComparisonPage: React.FC<{ documentId: number }> = ({ documentId }) => {
  const [data, setData] = useState<ComparisonPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/documents/${documentId}/comparison`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json: ComparisonPayload = await res.json();
        if (cancelled) return;
        console.log('[ComparisonPage] loaded:', {
          documentId: json.documentId,
          fileName: json.fileName,
          blocks: json.blocks?.length,
          firstBlockLineBoxes: json.blocks?.[0]?.lineBoxes?.length ?? 0,
        });
        setData(json);
      } catch (e: any) {
        console.error('[ComparisonPage] fetch error:', e);
        if (!cancelled) setError(e?.message || 'Failed to load comparison.');
      }
    })();
    return () => { cancelled = true; };
  }, [documentId]);

  if (error) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: COLORS.chatBoxBg, color: '#f87171',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontFamily: 'monospace', fontSize: '14px',
      }}>
        Failed to load comparison: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: COLORS.chatBoxBg, color: COLORS.sidebarText,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontFamily: 'monospace', fontSize: '14px',
      }}>
        Loading document #{documentId}…
      </div>
    );
  }

  return (
    <PdfComparator
      fileUrl={data.fileUrl}
      fileName={data.fileName}
      blocks={data.blocks}
      pageDimensions={data.pageDimensions}
      colors={COLORS}
      onClose={() => window.close()}
    />
  );
};

export default ComparisonPage;