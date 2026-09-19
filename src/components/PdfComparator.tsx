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
const MAX_ZOOM = 5;          // ↑ raised from 3 so users can zoom into fine print
const ZOOM_STEP = 0.25;
const FIT_PADDING = 32;

const MIN_VISIBLE_W = 4;
const MIN_VISIBLE_H = 4;

const MAX_BBOX_AREA_FRACTION = 0.5;
const MAX_BBOX_HEIGHT_FRACTION = 0.5;

/**
 * Base render scale on top of DPR. 2.5–3 gives crisp text even when the
 * user zooms up to ~3×. Combined with DPR, this typically produces a
 * canvas that's 2.5×–6× the on-screen size, so browser downscaling is
 * always sharp.
 */
const BASE_RENDER_SCALE = 2.5;

const normalizeBbox = (r: Bbox): Bbox => {
  let { x, y, width, height } = r;
  if (width < 0) { x = x + width; width = Math.abs(width); }
  if (height < 0) { y = y + height; height = Math.abs(height); }
  return { x, y, width, height };
};

const isBboxSane = (r: Bbox, pageW: number, pageH: number): boolean => {
  const n = normalizeBbox(r);
  if (n.width <= 0 || n.height <= 0) return false;
  const areaFraction = (n.width * n.height) / (pageW * pageH);
  if (areaFraction > MAX_BBOX_AREA_FRACTION) return false;
  if (n.height / pageH > MAX_BBOX_HEIGHT_FRACTION) return false;
  return true;
};

const clampRect = (r: Bbox, pageW: number, pageH: number): Bbox => {
  const n = normalizeBbox(r);
  let x = n.x, y = n.y, w = n.width, h = n.height;
  if (x + w <= 0) x = 0;
  if (y + h <= 0) y = 0;
  if (x >= pageW) x = Math.max(0, pageW - MIN_VISIBLE_W);
  if (y >= pageH) y = Math.max(0, pageH - MIN_VISIBLE_H);
  x = Math.max(0, Math.min(x, pageW));
  y = Math.max(0, Math.min(y, pageH));
  const maxW = pageW - x;
  const maxH = pageH - y;
  w = Math.max(MIN_VISIBLE_W, Math.min(w, maxW));
  h = Math.max(MIN_VISIBLE_H, Math.min(h, maxH));
  return { x, y, width: w, height: h };
};

const boxesForBlock = (block: ParsedBlock, pageW: number, pageH: number): Bbox[] => {
  const candidates: Bbox[] =
    block.lineBoxes && block.lineBoxes.length > 0 ? block.lineBoxes : [block.bbox];

  const drawn: Bbox[] = [];
  for (const raw of candidates) {
    if (!isBboxSane(raw, pageW, pageH)) {
      console.warn(`[PdfComparator] Rejecting insane bbox for block ${block.id}:`, raw);
      continue;
    }
    const rect = clampRect(raw, pageW, pageH);
    if (rect.width >= MIN_VISIBLE_W && rect.height >= MIN_VISIBLE_H) drawn.push(rect);
  }

  if (drawn.length === 0 && isBboxSane(block.bbox, pageW, pageH)) {
    drawn.push(clampRect(block.bbox, pageW, pageH));
  }

  if (drawn.length === 0) {
    const lineHeight = Math.min(24, pageH * 0.03);
    const boxW = Math.min(pageW * 0.3, 200);
    const rawY = block.bbox?.y ?? pageH * 0.5;
    const safeY = Math.max(0, Math.min(rawY, pageH - lineHeight));
    const rawX = block.bbox?.x ?? pageW * 0.5;
    const safeX = Math.max(0, Math.min(rawX, pageW - boxW));
    drawn.push({ x: safeX, y: safeY, width: boxW, height: lineHeight });
    console.warn(`[PdfComparator] Synthesized fallback bbox for block ${block.id}`);
  }

  return drawn;
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

  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      } catch (err: any) {
        console.error('[PdfComparator] load error', err);
        setPdfError(err?.message || 'Failed to load PDF');
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  /**
   * RENDER CANVASES
   *
   * This effect must depend on `zoom` (and containerWidth / pageDimensions
   * via fitPageWidth) so that when the user zooms, we re-render at a
   * higher internal resolution. Previously the dependency array was
   * [pdfDoc, numPages] only, so zooming just stretched a low-res bitmap.
   */
  useEffect(() => {
    if (!pdfDoc) return;
    if (zoomedPageWidth === 0) return;
    if (!fitPageWidth) return;

    let cancelled = false;

    (async () => {
      const dpr = window.devicePixelRatio || 1;

      for (let n = 1; n <= pdfDoc.numPages; n++) {
        if (cancelled) return;
        const canvas = document.getElementById(`pdf-canvas-${n}`) as HTMLCanvasElement | null;
        if (!canvas) continue;

        try {
          const page = await pdfDoc.getPage(n);
          const baseVp = page.getViewport({ scale: 1 });

          // The CSS size (what the user sees on screen) for this page:
          const cssWidth = zoomedPageWidth;
          const cssHeight = (cssWidth * baseVp.height) / baseVp.width;

          // The internal render scale: enough to fill the CSS size times
          // BASE_RENDER_SCALE times DPR. This guarantees crisp rendering
          // at any zoom level up to ~BASE_RENDER_SCALE× on a HiDPI display.
          const renderScale = (cssWidth * dpr * BASE_RENDER_SCALE) / baseVp.width;

          const vp = page.getViewport({ scale: renderScale });
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);

          // Force the canvas CSS size to match the on-screen size, so the
          // browser downsamples rather than upsamples.
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${cssHeight}px`;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) continue;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Reset transform in case pdfjs leaves one behind
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        } catch (e) {
          console.warn(`render page ${n} failed`, e);
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, numPages, zoom, zoomedPageWidth, fitPageWidth]);

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

  const fitPageWidth = useMemo(() => {
    if (containerWidth <= 0) return 0;
    return Math.max(200, containerWidth - FIT_PADDING);
  }, [containerWidth]);

  const zoomedPageWidth = fitPageWidth > 0 ? fitPageWidth * zoom : 0;

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

  const rectsForPage = (n: number): { rects: Bbox[]; isDebug: boolean; blockId: string | null } => {
    const llamaDims = pageDimensions[n];
    if (!llamaDims) return { rects: [], isDebug: false, blockId: null };

    if (showAllBoxes) {
      const out: Bbox[] = [];
      for (const b of blocks) {
        if (b.page !== n) continue;
        const boxes = boxesForBlock(b, llamaDims.width, llamaDims.height);
        for (const r of boxes) out.push(r);
      }
      return { rects: out, isDebug: true, blockId: null };
    }

    if (!activeBlock || activeBlock.page !== n) return { rects: [], isDebug: false, blockId: null };

    const boxes = boxesForBlock(activeBlock, llamaDims.width, llamaDims.height);
    return { rects: boxes, isDebug: false, blockId: activeBlock.id };
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
                      {/* Canvas is now rendered at high resolution internally
                          and displayed at the CSS size we control here. */}
                      <canvas
                        id={`pdf-canvas-${n}`}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: '100%',
                          background: '#fff',
                          // Hint the browser to keep it sharp on downscale
                          imageRendering: 'auto',
                        }}
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