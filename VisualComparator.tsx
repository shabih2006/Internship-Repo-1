import React, { useState, useRef, MouseEvent, WheelEvent } from 'react';

interface Props {
  beforeImage: string;
  afterImage: string;
}

export const VisualComparator: React.FC<Props> = ({ beforeImage, afterImage }) => {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Handle Slider Movement (Split Screen)
  const handleSliderMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || isDragging) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  // 2. Handle Mouse Wheel Zoom
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prevZoom) => Math.min(Math.max(prevZoom * zoomFactor, 1), 5)); // Clamped 1x to 5x
  };

  // 3. Handle Click & Drag Panning when Zoomed In
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else {
      handleSliderMove(e);
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Double click to reset zoom & position
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div
        ref={containerRef}
        className="relative w-[600px] h-[400px] overflow-hidden rounded-xl border-2 border-slate-700 cursor-crosshair shadow-2xl"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleReset}
      >
        {/* Canvas / Dynamic Zoom Box */}
        <div
          className="absolute inset-0 w-full h-full transition-transform duration-75 ease-out"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center center',
          }}
        >
          {/* After Image (Background) */}
          <img
            src={afterImage}
            alt="After"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />

          {/* Before Image (Clipped Overlay) */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src={beforeImage}
              alt="Before"
              className="absolute inset-0 w-[600px] h-[400px] max-w-none object-cover"
            />
          </div>
        </div>

        {/* Divider Slider Line */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_10px_#22d3ee] pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -left-3 w-7 h-7 bg-slate-900 border-2 border-cyan-400 rounded-full flex items-center justify-center text-xs text-cyan-400 font-bold">
            ↔
          </div>
        </div>
      </div>

      {/* Control Tips */}
      <p className="text-xs text-slate-400">
        🔍 <span className="text-slate-200 font-semibold">Scroll</span> to Zoom •{' '}
        <span className="text-slate-200 font-semibold">Drag</span> to Pan •{' '}
        <span className="text-slate-200 font-semibold">Double Click</span> to Reset
      </p>
    </div>
  );
};