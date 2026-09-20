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
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const FIT_PADDING = 32;

const MIN_VISIBLE_W = 4;
const MIN_VISIBLE_H = 4;

const MAX_BBOX_AREA_FRACTION = 0.5;
const MAX_BBOX_HEIGHT_FRACTION = 0.5;

const RENDER_QUALITY = 2;

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

const estimateLineCount = (block: ParsedBlock, pageW: number): number => {
  const text = (block.plainValue || block.markdown || '').trim();
  if (!text) return 1;
  const explicitLines = text.split(/\r?\n/).length;
  const charsPerLine = Math.max(20, Math.floor(pageW / 7));
  let wrapped = 0;
  for (const line of text.split(/\r?\n/)) {
    wrapped += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return Math.max(explicitLines, wrapped, 1);
};

const boxesForBlock = (
  block: ParsedBlock,
  pageW: number,
  pageH: number
): { rects: Bbox[]; synthesized: boolean } => {
  const candidates: Bbox[] =
    block.lineBoxes && block.lineBoxes.length > 0 ? block.lineBoxes : [block.bbox];

  const drawn: Bbox[] = [];
  for (const raw of candidates) {
    if (!isBboxSane(raw, pageW, pageH)) continue;
    const rect = clampRect(raw, pageW, pageH);
    if (rect.width >= MIN_VISIBLE_W && rect.height >= MIN_VISIBLE_H) drawn.push(rect);
  }

  if (drawn.length > 1) return { rects: drawn, synthesized: false };

  const blockBox =
    drawn[0] ??
    (isBboxSane(block.bbox, pageW, pageH) ? clampRect(block.bbox, pageW, pageH) : null);

  if (!blockBox) {
    const lineHeight = Math.min(24, pageH * 0.03);
    const boxW = Math.min(pageW * 0.3, 200);
    const rawY = block.bbox?.y ?? pageH * 0.5;
    const safeY = Math.max(0, Math.min(rawY, pageH - lineHeight));
    const rawX = block.bbox?.x ?? pageW * 0.5;
    const safeX = Math.max(0, Math.min(rawX, pageW - boxW));
    return { rects: [{ x: safeX, y: safeY, width: boxW, height: lineHeight }], synthesized: true };
  }

  if (blockBox.height < 40) return { rects: [blockBox], synthesized: true };

  const lineCount = Math.min(12, Math.max(1, estimateLineCount(block, pageW)));
  const sliceHeight = blockBox.height / lineCount;
  const slices: Bbox[] = [];
  for (let i = 0; i < lineCount; i++) {
    slices.push({
      x: blockBox.x,
      y: blockBox.y + i * sliceHeight,
      width: blockBox.width,
      height: sliceHeight,
    });
  }
  return { rects: slices, synthesized: true };
};

const liquidGlass = (tint: string, isDark: boolean, intensity: number = 1): React.CSSProperties => {
  const blurAmount = 20 * intensity;
  const saturateAmount = 180 * intensity;
  const brightnessAmount = isDark ? 1.1 : 1.25;

  let tintRgba = tint;
  if (tint.startsWith('#')) {
    const hex = tint.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    tintRgba = `rgba(${r}, ${g}, ${b}, 0.25)`;
  }

  return {
    background: `linear-gradient(135deg, ${tintRgba} 0%, rgba(255,255,255,${
      isDark ? 0.08 : 0.35
    }) 50%, ${tintRgba} 100%)`,
    backdropFilter: `blur(${blurAmount}px) saturate(${saturateAmount}%) brightness(${brightnessAmount})`,
    WebkitBackdropFilter: `blur(${blurAmount}px) saturate(${saturateAmount}%) brightness(${brightnessAmount})`,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.65)'}`,
    boxShadow: isDark
      ? `0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.15), inset 0 -1px 1px rgba(0, 0, 0, 0.2)`
      : `0 8px 32px rgba(31, 38, 135, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.9), inset 0 -1px 1px rgba(0, 0, 0, 0.05)`,
    borderRadius: '16px',
    transition: 'all 0.3s ease',
  };
};

const liquidGlassButton = (tint: string, isDark: boolean, isActive: boolean = false): React.CSSProperties => {
  const base = liquidGlass(tint, isDark, 0.8);
  return {
    ...base,
    borderRadius: '12px',
    padding: '10px 16px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    outline: 'none',
    opacity: isActive ? 1 : 0.9,
    transform: isActive ? 'scale(0.98)' : 'scale(1)',
    boxShadow: isActive
      ? `0 4px 16px rgba(0,0,0,0.3), inset 0 2px 4px rgba(0,0,0,0.2)`
      : base.boxShadow,
  };
};

/**
 * Decide the rotation PDF.js should apply when rendering a page.
 *
 * The problem: PDF.js reports `page.rotate` from metadata, but some PDFs
 * (especially print-ready layouts) have their *content stream* drawn
 * rotated 90° while `page.rotate` stays 0. The page renders inverted.
 *
 * The signal: LlamaParse gives us `llamaDims` — the TRUE upright
 * dimensions of the page. If PDF.js's native viewport aspect-ratio
 * disagrees with that (portrait vs. landscape), the content stream
 * is rotated 90° and we must compensate.
 *
 * Returns one of 0, 90, 180, 270.
 */
const decideRenderRotation = (
  pdfjsNativeW: number,
  pdfjsNativeH: number,
  pdfjsNativeRotate: number,
  llamaW: number | undefined,
  llamaH: number | undefined,
): 0 | 90 | 180 | 270 => {
  // Normalize the PDF.js reported rotation to our 4 valid values.
  const nativeRot: 0 | 90 | 180 | 270 =
    ((pdfjsNativeRotate % 360) + 360) % 360 === 90 ? 90
    : ((pdfjsNativeRotate % 360) + 360) % 360 === 180 ? 180
    : ((pdfjsNativeRotate % 360) + 360) % 360 === 270 ? 270
    : 0;

  // No Llama reference — trust the PDF's own metadata.
  if (!llamaW || !llamaH) {
    return nativeRot;
  }

  // Compute aspect-ratio orientation of each source.
  const pdfPortrait = pdfjsNativeH >= pdfjsNativeW;
  const llamaPortrait = llamaH >= llamaW;

  // Mismatch → the content stream is rotated 90° from the metadata.
  // We swap the rotation direction based on whether the PDF's own
  // metadata already says 90/270.
  if (pdfPortrait !== llamaPortrait) {
    if (nativeRot === 90) return 270;
    if (nativeRot === 270) return 90;
    // Native is 0 or 180. Pick 90 (a common choice for "wrong axis" PDFs).
    // If it renders upside-down, switch to 270.
    return 90;
  }

  // Same aspect ratio → the metadata's rotation is the correct one.
  return nativeRot;
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
  const [renderRotsByPage, setRenderRotsByPage] = useState<Record<number, number>>({});
  const [showAllBoxes, setShowAllBoxes] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pendingIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const committedIdRef = useRef<string | null>(null);

  const fitPageWidth = useMemo(() => {
    const w = containerWidth > 0 ? containerWidth : 600;
    return Math.max(240, w - FIT_PADDING);
  }, [containerWidth]);

  const cssPageWidth = fitPageWidth * zoom;

  const isDark = (() => {
    const bg = colors.chatBoxBg || '';
    if (bg.startsWith('#')) {
      const hex = bg.replace('#', '');
      if (hex.length >= 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return (r + g + b) / 3 < 128;
      }
    }
    if (bg.startsWith('rgba')) {
      const parts = bg.replace(/rgba?\(|\)/g, '').split(',');
      if (parts.length >= 3) {
        const r = parseInt(parts[0].trim(), 10);
        const g = parseInt(parts[1].trim(), 10);
        const b = parseInt(parts[2].trim(), 10);
        return (r + g + b) / 3 < 128;
      }
    }
    return true;
  })();

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

  // Measure pane width.
  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const measure = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const w = el.clientWidth;
        if (w > 0) setContainerWidth(w);
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Load PDF, compute per-page rotation and store final upright dims.
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
        const rots: Record<number, number> = {};

        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelled) return;
          const page = await doc.getPage(n);

          // Unrotated native dimensions from PDF.js.
          const nativeVp = page.getViewport({ scale: 1, rotation: 0 });
          const nativeRotate = page.rotate || 0;
          const llamaDims = pageDimensions[n];

          const renderRot = decideRenderRotation(
            nativeVp.width,
            nativeVp.height,
            nativeRotate,
            llamaDims?.width,
            llamaDims?.height,
          );
          rots[n] = renderRot;

          const finalVp = page.getViewport({ scale: 1, rotation: renderRot });
          dims[n] = { width: finalVp.width, height: finalVp.height };

          console.log(
            `[PdfComparator] page ${n}: native=${nativeVp.width.toFixed(0)}×${nativeVp.height.toFixed(0)}`,
            `nativeRot=${nativeRotate}`,
            `llama=${llamaDims ? `${llamaDims.width.toFixed(0)}×${llamaDims.height.toFixed(0)}` : 'n/a'}`,
            `→ renderRotation=${renderRot}`,
            `final=${finalVp.width.toFixed(0)}×${finalVp.height.toFixed(0)}`,
          );
        }

        setPdfDimsByPage(dims);
        setRenderRotsByPage(rots);
      } catch (err: any) {
        console.error('[PdfComparator] load error', err);
        setPdfError(err?.message || 'Failed to load PDF');
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl, pageDimensions]);

  /**
   * Render each canvas using the per-page rotation decided above.
   * Keep this simple: don't pass ctx.transform or render({transform}).
   */
  useEffect(() => {
    if (!pdfDoc) return;
    if (cssPageWidth <= 0) return;
    if (Object.keys(renderRotsByPage).length === 0) return;

    let cancelled = false;

    (async () => {
      const dpr = window.devicePixelRatio || 1;

      for (let n = 1; n <= pdfDoc.numPages; n++) {
        if (cancelled) return;
        const canvas = document.getElementById(`pdf-canvas-${n}`) as HTMLCanvasElement | null;
        if (!canvas) continue;

        try {
          const page = await pdfDoc.getPage(n);
          const renderRot = renderRotsByPage[n] ?? 0;

          const baseVp = page.getViewport({ scale: 1, rotation: renderRot });
          const renderScale = (cssPageWidth * dpr * RENDER_QUALITY) / baseVp.width;
          const vp = page.getViewport({ scale: renderScale, rotation: renderRot });

          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) continue;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: ctx,
            viewport: vp,
          }).promise;
        } catch (e) {
          console.warn(`render page ${n} failed`, e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, numPages, cssPageWidth, renderRotsByPage]);

  // Ctrl + wheel zoom.
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

  // Scroll hovered block into view.
  useEffect(() => {
    if (!activeBlock || cssPageWidth === 0) return;
    const container = pdfContainerRef.current;
    if (!container) return;
    const llamaDims = pageDimensions[activeBlock.page];
    if (!llamaDims) return;
    const pageEl = container.querySelector(
      `[data-page-marker="${activeBlock.page}"]`
    ) as HTMLElement | null;
    if (!pageEl) return;

    const cRect = container.getBoundingClientRect();
    const pRect = pageEl.getBoundingClientRect();
    const displayScale = cssPageWidth / llamaDims.width;
    const refY = activeBlock.bbox.y;

    const target =
      pRect.top - cRect.top + container.scrollTop + refY * displayScale -
      container.clientHeight / 2;

    if (Math.abs(container.scrollTop - target) > 60) {
      container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
  }, [activeBlock, pageDimensions, cssPageWidth]);

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages]
  );

  const rectsForPage = (
    n: number
  ): { rects: Bbox[]; isDebug: boolean; blockId: string | null; synthesized: boolean } => {
    const llamaDims = pageDimensions[n];
    if (!llamaDims) return { rects: [], isDebug: false, blockId: null, synthesized: false };

    if (showAllBoxes) {
      const out: Bbox[] = [];
      for (const b of blocks) {
        if (b.page !== n) continue;
        const { rects } = boxesForBlock(b, llamaDims.width, llamaDims.height);
        for (const r of rects) out.push(r);
      }
      return { rects: out, isDebug: true, blockId: null, synthesized: false };
    }

    if (!activeBlock || activeBlock.page !== n) {
      return { rects: [], isDebug: false, blockId: null, synthesized: false };
    }

    const { rects, synthesized } = boxesForBlock(activeBlock, llamaDims.width, llamaDims.height);
    return { rects, isDebug: false, blockId: activeBlock.id, synthesized };
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          ...liquidGlass(colors.chatBoxBg, isDark, 1.5),
          width: '96%',
          maxWidth: '1500px',
          height: '92vh',
          minHeight: 0,
          minWidth: 0,
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
            paddingBottom: '10px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
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
              ...liquidGlassButton(showAllBoxes ? '#f59e0b' : colors.sidebarBorder, isDark, showAllBoxes),
              color: showAllBoxes ? '#000' : colors.sidebarText,
              fontSize: '12px',
              padding: '6px 12px',
            }}
          >
            {showAllBoxes ? '✓ All boxes' : 'Show all boxes'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              style={{
                ...liquidGlassButton(colors.sidebarBorder, isDark),
                width: '30px',
                height: '30px',
                color: colors.sidebarText,
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: zoom <= MIN_ZOOM ? 'not-allowed' : 'pointer',
                opacity: zoom <= MIN_ZOOM ? 0.4 : 1,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
              }}
            >
              −
            </button>
            <span
              style={{
                fontSize: '12px',
                color: colors.sidebarText,
                minWidth: '44px',
                textAlign: 'center',
                fontFamily: 'monospace',
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              style={{
                ...liquidGlassButton(colors.sidebarBorder, isDark),
                width: '30px',
                height: '30px',
                color: colors.sidebarText,
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: zoom >= MAX_ZOOM ? 'not-allowed' : 'pointer',
                opacity: zoom >= MAX_ZOOM ? 0.4 : 1,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
              }}
            >
              +
            </button>
            <button
              onClick={() => setZoom(1)}
              style={{
                ...liquidGlassButton(colors.sidebarBorder, isDark),
                color: colors.sidebarText,
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '8px',
              }}
            >
              Fit
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.mainTitle,
              fontSize: '22px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            ✖
          </button>
        </div>

        {/* Split */}
        <div style={{ flex: 1, display: 'flex', gap: '14px', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
          {/* LEFT — PDF */}
          <div
            ref={pdfContainerRef}
            style={{
              ...liquidGlass(colors.assistantBubbleBg, isDark, 0.6),
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              overflow: 'auto',
              borderRadius: '16px',
              padding: '16px 0',
            }}
          >
            {pdfError && (
              <div style={{ padding: '16px', color: '#f87171', fontSize: '13px' }}>
                Failed to load PDF: {pdfError}
              </div>
            )}

            {cssPageWidth > 0 &&
              pageNumbers.map((n) => {
                const pdfDims = pdfDimsByPage[n];
                const llamaDims = pageDimensions[n];
                const pageWidthPx = cssPageWidth;
                const pageHeightPx = pdfDims
                  ? (pageWidthPx * pdfDims.height) / pdfDims.width
                  : pageWidthPx * (11 / 8.5);

                const llamaToPdfX =
                  pdfDims && llamaDims && llamaDims.width > 0
                    ? pdfDims.width / llamaDims.width
                    : 1;
                const llamaToPdfY =
                  pdfDims && llamaDims && llamaDims.height > 0
                    ? pdfDims.height / llamaDims.height
                    : 1;

                const scaleX = pdfDims ? pageWidthPx / pdfDims.width : 1;
                const scaleY = pdfDims ? pageHeightPx / pdfDims.height : 1;

                const { rects, isDebug, blockId, synthesized } = rectsForPage(n);

                return (
                  <div
                    key={n}
                    style={{
                      width: `${pageWidthPx}px`,
                      flexShrink: 0,
                      margin: '0 auto 16px auto',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10px',
                        opacity: 0.5,
                        color: colors.sidebarText,
                        marginBottom: '4px',
                        textAlign: 'center',
                      }}
                    >
                      Page {n}
                      {pdfDims && ` · pdf:${pdfDims.width.toFixed(0)}×${pdfDims.height.toFixed(0)}`}
                      {llamaDims && ` · llama:${llamaDims.width.toFixed(0)}×${llamaDims.height.toFixed(0)}`}
                    </div>

                    <div
                      style={{
                        position: 'relative',
                        width: `${pageWidthPx}px`,
                        height: `${pageHeightPx}px`,
                        background: '#ffffff',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <canvas
                        id={`pdf-canvas-${n}`}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: '100%',
                        }}
                      />

                      <div
                        data-page-marker={n}
                        style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1 }}
                      />

                      {llamaDims &&
                        rects.map((r, i) => (
                          <div
                            key={i}
                            data-block-id={!isDebug ? blockId : undefined}
                            style={{
                              position: 'absolute',
                              left: r.x * llamaToPdfX * scaleX,
                              top: r.y * llamaToPdfY * scaleY,
                              width: r.width * llamaToPdfX * scaleX,
                              height: Math.max(r.height * llamaToPdfY * scaleY, 4),
                              background: isDebug
                                ? 'rgba(0,200,255,0.10)'
                                : synthesized
                                ? 'rgba(168, 85, 247, 0.20)'
                                : 'rgba(255, 215, 0, 0.38)',
                              border: isDebug
                                ? '1px dashed rgba(0,200,255,0.5)'
                                : synthesized
                                ? '1px dashed rgba(168, 85, 247, 0.85)'
                                : '1.5px solid rgba(245, 158, 11, 0.95)',
                              borderRadius: '2px',
                              pointerEvents: 'none',
                              mixBlendMode: 'multiply',
                            }}
                          />
                        ))}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* RIGHT — Blocks */}
          <div
            style={{
              ...liquidGlass(colors.assistantBubbleBg, isDark, 0.6),
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              overflowY: 'auto',
              borderRadius: '16px',
              padding: '14px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: colors.sidebarTitle,
                textTransform: 'uppercase',
                marginBottom: '10px',
                fontWeight: 'bold',
                opacity: 0.85,
              }}
            >
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
                    ...(isHovered ? liquidGlass('rgba(34, 197, 94, 0.3)', isDark, 0.4) : {}),
                    padding: '10px 12px',
                    margin: '6px 0',
                    borderRadius: '10px',
                    borderLeft: isHovered ? '4px solid #22c55e' : '4px solid transparent',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    lineHeight: '1.55',
                    color: colors.sidebarText,
                    transition: 'all 0.15s ease',
                    minWidth: 0,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                  }}
                >
                  <div
                    style={{
                      fontSize: '9px',
                      opacity: 0.55,
                      marginBottom: '4px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {block.id} · bbox({block.bbox.x.toFixed(0)},{block.bbox.y.toFixed(0)}{' '}
                    {block.bbox.width.toFixed(0)}×{block.bbox.height.toFixed(0)})
                  </div>

                  {block.type === 'table' && block.html ? (
                    <div className="cmp-table" dangerouslySetInnerHTML={{ __html: block.html }} />
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        p: ({ children }) => (
                          <p style={{ margin: '0 0 8px', lineHeight: 1.55 }}>{children}</p>
                        ),
                        h1: ({ children }) => (
                          <h1 style={{ fontSize: '18px', margin: '8px 0 4px', color: colors.mainTitle }}>
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 style={{ fontSize: '15px', margin: '6px 0 4px', color: colors.mainTitle }}>
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 style={{ fontSize: '13px', margin: '6px 0 3px', color: colors.sidebarTitle }}>
                            {children}
                          </h3>
                        ),
                        table: ({ children }) => (
                          <div style={{ overflowX: 'auto', margin: '8px 0', maxWidth: '100%' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '100%' }}>
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th
                            style={{
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
                              padding: '5px 8px',
                              textAlign: 'left',
                              background: 'rgba(255,255,255,0.05)',
                              wordBreak: 'break-word',
                            }}
                          >
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td
                            style={{
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
                              padding: '5px 8px',
                              verticalAlign: 'top',
                              wordBreak: 'break-word',
                            }}
                          >
                            {children}
                          </td>
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