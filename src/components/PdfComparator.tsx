import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface Bbox { x: number; y: number; width: number; height: number; }
interface ParsedBlock {
  id: string;
  type: 'text' | 'heading' | 'table';
  markdown: string;
  plainValue: string;
  html?: string;
  page: number;
  bbox: Bbox;
  lineBoxes?: Bbox[];
}
interface PageDim { width: number; height: number; }

interface Colors {
  chatBoxBg: string;
  chatBoxBorder: string;
  sidebarBorder: string;
  sidebarTitle: string;
  sidebarText: string;
  mainTitle: string;
  assistantBubbleBg: string;
  newChatBtn: string;
  newChatBtnText: string;
}

interface Props {
  fileUrl: string;
  fileName: string;
  blocks: ParsedBlock[];
  pageDimensions: Record<number, PageDim>;
  colors: Colors;
  onClose: () => void;
}

const STANDARD_FONTS_URL = 'https://unpkg.com/pdfjs-dist@6.3.289/standard_fonts/';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;
const FIT_PADDING = 32; // px of breathing room around the page

const clampRect = (r: Bbox, pageW: number, pageH: number): Bbox => {
  const x = Math.max(0, Math.min(r.x, pageW));
  const y = Math.max(0, Math.min(r.y, pageH));
  const w = Math.max(0, Math.min(r.width, pageW - x));
  const h = Math.max(0, Math.min(r.height, pageH - y));
  return { x, y, width: w, height: h };
};

export const PdfComparator: React.FC<Props> = ({
  fileUrl, fileName, blocks, pageDimensions, colors, onClose,
}) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfDimsByPage, setPdfDimsByPage] = useState<Record<number, PageDim>>({});
  const [showAllBoxes, setShowAllBoxes] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pendingIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const committedIdRef = useRef<string | null>(null);

  const scheduleHover = useCallback((id: string | null) => {
    pendingIdRef.current = id;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const next = pendingIdRef.current;
      if (next === committedIdRef.current) return;
      committedIdRef.current = next;
      setHoveredBlockId(next);
    });
  }, []);

  // Measure container width for auto-fit
  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load PDF + capture pdfjs viewport dims
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!fileUrl) { setPdfError('No file URL'); return; }
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        const doc = await pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          standardFontDataUrl: STANDARD_FONTS_URL,
        }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);

        const dims: Record<number, PageDim> = {};
        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          const vp = page.getViewport({ scale: 1 });
          dims[n] = { width: vp.width, height: vp.height };
        }
        setPdfDimsByPage(dims);
        console.log('[PdfComparator] pdfjs dims:', dims);
        console.log('[PdfComparator] llama dims:', pageDimensions);
      } catch (err: any) {
        console.error('[PdfComparator] load error', err);
        setPdfError(err?.message || 'Failed to load PDF');
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  // Render canvases
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      const dpr = window.devicePixelRatio || 1;
      for (let n = 1; n <= pdfDoc.numPages; n++) {
        if (cancelled) return;
        const canvas = document.getElementById(`pdf-canvas-${n}`) as HTMLCanvasElement | null;
        if (!canvas) continue;
        try {
          const page = await pdfDoc.getPage(n);
          const vp = page.getViewport({ scale: dpr });
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        } catch (e) { console.warn(`render page ${n} failed`, e); }
      }
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, numPages]);

  // Ctrl+wheel zoom
  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((prev) => {
        const next = prev * (e.deltaY < 0 ? 1.1 : 0.9);
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const blocksById = useMemo(() => {
    const m = new Map<string, ParsedBlock>();
    for (const b of blocks) m.set(b.id, b);
    return m;
  }, [blocks]);

  const activeBlock = hoveredBlockId ? blocksById.get(hoveredBlockId) ?? null : null;

  // Fit-to-width page pixel width — this becomes the "100%" reference
  const fitPageWidth = useMemo(() => {
    if (containerWidth <= 0) return 0;
    return Math.max(200, containerWidth - FIT_PADDING);
  }, [containerWidth]);

  const zoomedPageWidth = fitPageWidth > 0 ? fitPageWidth * zoom : 0;

  // Auto-scroll to top of the hovered block's bbox
  useEffect(() => {
    if (!activeBlock || zoomedPageWidth === 0) return;
    const container = pdfContainerRef.current;
    if (!container) return;
    const llamaDims = pageDimensions[activeBlock.page];
    if (!llamaDims) return;
    const pageEl = container.querySelector(`[data-page-marker="${activeBlock.page}"]`) as HTMLElement | null;
    if (!pageEl) return;

    const cRect = container.getBoundingClientRect();
    const pRect = pageEl.getBoundingClientRect();
    const displayScale = zoomedPageWidth / llamaDims.width;
    const refY = activeBlock.bbox.y;

    const target = pRect.top - cRect.top + container.scrollTop + refY * displayScale - container.clientHeight / 2;

    if (Math.abs(container.scrollTop - target) > 60) {
      container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
  }, [activeBlock, pageDimensions, zoomedPageWidth]);

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages]
  );

  // Rects to draw on page n, using LlamaParse page units
  const rectsForPage = (n: number): { rects: Bbox[]; isDebug: boolean; blockId: string | null } => {
    const llamaDims = pageDimensions[n];
    if (!llamaDims) return { rects: [], isDebug: false, blockId: null };

    if (showAllBoxes) {
      const out: Bbox[] = [];
      for (const b of blocks) {
        if (b.page !== n) continue;
        const raw = b.lineBoxes && b.lineBoxes.length > 0 ? b.lineBoxes : [b.bbox];
        for (const r of raw) {
          if (r.width <= 0 || r.height <= 0) continue;
          out.push(clampRect(r, llamaDims.width, llamaDims.height));
        }
      }
      return { rects: out, isDebug: true, blockId: null };
    }

    if (!activeBlock || activeBlock.page !== n) return { rects: [], isDebug: false, blockId: null };

    const raw = activeBlock.lineBoxes && activeBlock.lineBoxes.length > 0
      ? activeBlock.lineBoxes
      : [activeBlock.bbox];

    const out: Bbox[] = [];
    for (const r of raw) {
      if (r.width <= 0 || r.height <= 0) continue;
      out.push(clampRect(r, llamaDims.width, llamaDims.height));
    }
    return { rects: out, isDebug: false, blockId: activeBlock.id };
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(6px)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 9999,
    }}>
      <div style={{
        width: '96%', maxWidth: '1500px', height: '92vh',
        background: colors.chatBoxBg,
        border: `2px solid ${colors.chatBoxBorder}`,
        borderRadius: '16px', padding: '18px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '12px', borderBottom: `1px solid ${colors.sidebarBorder}`,
          paddingBottom: '10px', gap: '12px', flexWrap: 'wrap',
        }}>
          <div>
            <h3 style={{ margin: 0, color: colors.mainTitle, fontSize: '17px', fontWeight: 'bold' }}>
              📄 Visual Inspector: <span style={{ opacity: 0.8 }}>{fileName}</span>
            </h3>
            <div style={{ fontSize: '11px', opacity: 0.65, color: colors.sidebarText, marginTop: '3px' }}>
              {blocks.length} blocks · {numPages} pages
            </div>
          </div>

          <button
            onClick={() => setShowAllBoxes((v) => !v)}
            style={{
              padding: '6px 12px', fontSize: '12px', cursor: 'pointer',
              background: showAllBoxes ? '#f59e0b' : 'rgba(255,255,255,0.08)',
              color: showAllBoxes ? '#000' : colors.sidebarText,
              border: `1px solid ${colors.sidebarBorder}`, borderRadius: '6px',
            }}
          >{showAllBoxes ? '✓ All boxes' : 'Show all boxes'}</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              style={{
                width: '30px', height: '30px', borderRadius: '6px',
                border: `1px solid ${colors.sidebarBorder}`,
                background: 'rgba(255,255,255,0.08)',
                color: colors.sidebarText, fontSize: '16px', fontWeight: 'bold',
                cursor: zoom <= MIN_ZOOM ? 'not-allowed' : 'pointer',
                opacity: zoom <= MIN_ZOOM ? 0.4 : 1,
              }}
            >−</button>
            <span style={{ fontSize: '12px', color: colors.sidebarText, minWidth: '44px', textAlign: 'center', fontFamily: 'monospace' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              style={{
                width: '30px', height: '30px', borderRadius: '6px',
                border: `1px solid ${colors.sidebarBorder}`,
                background: 'rgba(255,255,255,0.08)',
                color: colors.sidebarText, fontSize: '16px', fontWeight: 'bold',
                cursor: zoom >= MAX_ZOOM ? 'not-allowed' : 'pointer',
                opacity: zoom >= MAX_ZOOM ? 0.4 : 1,
              }}
            >+</button>
            <button
              onClick={() => setZoom(1)}
              style={{
                padding: '4px 10px', borderRadius: '6px',
                border: `1px solid ${colors.sidebarBorder}`,
                background: 'rgba(255,255,255,0.08)',
                color: colors.sidebarText, fontSize: '11px', cursor: 'pointer',
              }}
            >Fit</button>
          </div>

          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: colors.mainTitle, fontSize: '22px',
            fontWeight: 'bold', cursor: 'pointer',
          }}>✖</button>
        </div>

        {/* Split */}
        <div style={{ flex: 1, display: 'flex', gap: '14px', overflow: 'hidden' }}>
          {/* LEFT — PDF */}
          <div
            ref={pdfContainerRef}
            style={{
              flex: 1, background: colors.assistantBubbleBg,
              borderRadius: '10px', overflow: 'auto',
              border: `1px solid ${colors.sidebarBorder}`,
            }}
          >
            {pdfError && (
              <div style={{ padding: '16px', color: '#f87171', fontSize: '13px' }}>
                Failed to load PDF: {pdfError}
              </div>
            )}

            {zoomedPageWidth > 0 && pageNumbers.map((n) => {
              const pdfDims = pdfDimsByPage[n];
              const llamaDims = pageDimensions[n];
              const pageWidthPx = zoomedPageWidth;
              const pageHeightPx = pdfDims ? (pageWidthPx * pdfDims.height) / pdfDims.width : 0;
              const displayScale = llamaDims ? pageWidthPx / llamaDims.width : 1;
              const { rects, isDebug, blockId } = rectsForPage(n);

              return (
                <div key={n} style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                  <div style={{ width: `${pageWidthPx}px` }}>
                    <div style={{ fontSize: '10px', opacity: 0.5, color: colors.sidebarText, marginBottom: '4px', textAlign: 'center' }}>
                      Page {n}
                      {pdfDims && ` · pdf:${pdfDims.width.toFixed(0)}×${pdfDims.height.toFixed(0)}`}
                      {llamaDims && ` · llama:${llamaDims.width.toFixed(0)}×${llamaDims.height.toFixed(0)}`}
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: pdfDims ? `${pageHeightPx}px` : 'auto',
                        overflow: 'hidden',
                      }}
                    >
                      <canvas
                        id={`pdf-canvas-${n}`}
                        style={{ width: '100%', height: '100%', display: 'block', background: '#fff' }}
                      />
                      <div data-page-marker={n} style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1 }} />

                      {llamaDims && rects.map((r, i) => (
                        <div
                          key={i}
                          data-block-id={!isDebug ? blockId : undefined}
                          style={{
                            position: 'absolute',
                            left: r.x * displayScale,
                            top: r.y * displayScale,
                            width: r.width * displayScale,
                            height: Math.max(r.height * displayScale, 4),
                            background: isDebug ? 'rgba(0,200,255,0.10)' : 'rgba(255, 215, 0, 0.38)',
                            border: isDebug ? '1px dashed rgba(0,200,255,0.5)' : '1.5px solid rgba(245, 158, 11, 0.95)',
                            borderRadius: '2px',
                            pointerEvents: 'none',
                            mixBlendMode: 'multiply',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT — Blocks */}
          <div style={{
            flex: 1, background: colors.assistantBubbleBg,
            borderRadius: '10px', overflowY: 'auto',
            border: `1px solid ${colors.sidebarBorder}`,
            padding: '14px',
          }}>
            <div style={{
              fontSize: '11px', color: colors.sidebarTitle,
              textTransform: 'uppercase', marginBottom: '10px',
              fontWeight: 'bold', opacity: 0.85,
            }}>
              Parsed Blocks
            </div>

            {blocks.map((block) => {
              const isHovered = hoveredBlockId === block.id;
              return (
                <div
                  key={block.id}
                  onMouseEnter={() => scheduleHover(block.id)}
                  onMouseLeave={() => scheduleHover(null)}
                  style={{
                    padding: '10px 12px',
                    margin: '6px 0',
                    borderRadius: '6px',
                    background: isHovered ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255,255,255,0.03)',
                    borderLeft: isHovered ? '4px solid #22c55e' : '4px solid transparent',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    lineHeight: '1.55',
                    color: colors.sidebarText,
                  }}
                >
                  <div style={{ fontSize: '9px', opacity: 0.55, marginBottom: '4px', fontFamily: 'monospace' }}>
                    {block.id} · bbox({block.bbox.x.toFixed(0)},{block.bbox.y.toFixed(0)} {block.bbox.width.toFixed(0)}×{block.bbox.height.toFixed(0)})
                  </div>

                  {block.type === 'table' && block.html ? (
                    <div className="cmp-table" dangerouslySetInnerHTML={{ __html: block.html }} />
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        p: ({ children }) => <p style={{ margin: '0 0 8px', lineHeight: 1.55 }}>{children}</p>,
                        h1: ({ children }) => <h1 style={{ fontSize: '18px', margin: '8px 0 4px', color: colors.mainTitle }}>{children}</h1>,
                        h2: ({ children }) => <h2 style={{ fontSize: '15px', margin: '6px 0 4px', color: colors.mainTitle }}>{children}</h2>,
                        h3: ({ children }) => <h3 style={{ fontSize: '13px', margin: '6px 0 3px', color: colors.sidebarTitle }}>{children}</h3>,
                        table: ({ children }) => (
                          <div style={{ overflowX: 'auto', margin: '8px 0' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th style={{
                            border: `1px solid ${colors.sidebarBorder}`,
                            padding: '5px 8px', textAlign: 'left',
                            background: 'rgba(255,255,255,0.05)',
                          }}>{children}</th>
                        ),
                        td: ({ children }) => (
                          <td style={{
                            border: `1px solid ${colors.sidebarBorder}`,
                            padding: '5px 8px', verticalAlign: 'top',
                          }}>{children}</td>
                        ),
                      }}
                    >
                      {block.markdown || block.plainValue}
                    </ReactMarkdown>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfComparator;