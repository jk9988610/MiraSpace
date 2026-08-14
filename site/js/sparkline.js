/**
 * Draw a mini sparkline for HUD metric history.
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} values
 * @param {{ color?: string, min?: number, max?: number, threshold?: number }} [opts]
 */
export function drawSparkline(canvas, values, opts = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!values || values.length < 2) {
    ctx.strokeStyle = "rgba(120, 160, 200, 0.25)";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    return;
  }

  const lo = opts.min ?? Math.min(...values);
  const hi = opts.max ?? Math.max(...values);
  const range = hi - lo || 1;

  if (opts.threshold != null) {
    const ty = h - 1 - ((opts.threshold - lo) / range) * (h - 2);
    ctx.strokeStyle = "rgba(232, 180, 77, 0.45)";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(w, ty);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = opts.color ?? "#7aa2c4";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let i = 0; i < values.length; i += 1) {
    const x = (i / (values.length - 1)) * (w - 2) + 1;
    const y = h - 1 - ((values[i] - lo) / range) * (h - 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
