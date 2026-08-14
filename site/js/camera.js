/**
 * Camera / observer: world ↔ screen transforms and single-pointer pan.
 * World: origin bottom-left, Y up. Screen: origin top-left, Y down.
 */
export class Camera {
  /**
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  constructor(worldWidth, worldHeight) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.camX = worldWidth / 2;
    this.camY = worldHeight / 2;
    this.viewportW = 1;
    this.viewportH = 1;
    this.zoom = 1;

    this._panning = false;
    this._activePointerId = null;
    this._startScreenX = 0;
    this._startScreenY = 0;
    this._startCamX = 0;
    this._startCamY = 0;
  }

  setViewport(width, height) {
    this.viewportW = Math.max(1, width);
    this.viewportH = Math.max(1, height);
  }

  /** Screen pixels per world unit (alias for zoom). */
  get scale() {
    return this.zoom;
  }

  /** @param {number} wx @param {number} wy */
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.camX) * this.zoom + this.viewportW * 0.5,
      y: (this.camY - wy) * this.zoom + this.viewportH * 0.5,
    };
  }

  /** @param {number} sx @param {number} sy */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.viewportW * 0.5) / this.zoom + this.camX,
      y: this.camY - (sy - this.viewportH * 0.5) / this.zoom,
    };
  }

  /** Visible world axis-aligned bounds (may extend outside [0, worldSize]). */
  getViewBounds() {
    const halfW = this.viewportW / (2 * this.zoom);
    const halfH = this.viewportH / (2 * this.zoom);
    return {
      left: this.camX - halfW,
      right: this.camX + halfW,
      bottom: this.camY - halfH,
      top: this.camY + halfH,
    };
  }

  /**
   * @param {HTMLElement} canvas
   */
  attachPanHandlers(canvas) {
    canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e, canvas));
    canvas.addEventListener("pointermove", (e) => this._onPointerMove(e));
    canvas.addEventListener("pointerup", (e) => this._onPointerUp(e, canvas));
    canvas.addEventListener("pointercancel", (e) => this._onPointerUp(e, canvas));
  }

  /** @param {PointerEvent} e @param {HTMLElement} canvas */
  _onPointerDown(e, canvas) {
    if (this._panning) return;
    this._panning = true;
    this._activePointerId = e.pointerId;
    this._startScreenX = e.clientX;
    this._startScreenY = e.clientY;
    this._startCamX = this.camX;
    this._startCamY = this.camY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
  }

  /** @param {PointerEvent} e */
  _onPointerMove(e) {
    if (!this._panning || e.pointerId !== this._activePointerId) return;
    const dx = e.clientX - this._startScreenX;
    const dy = e.clientY - this._startScreenY;
    this.camX = wrapCoord(this._startCamX - dx / this.zoom, this.worldWidth);
    this.camY = wrapCoord(this._startCamY + dy / this.zoom, this.worldHeight);
  }

  /** @param {PointerEvent} e @param {HTMLElement} canvas */
  _onPointerUp(e, canvas) {
    if (e.pointerId !== this._activePointerId) return;
    this._panning = false;
    this._activePointerId = null;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    canvas.classList.remove("dragging");
  }
}

/**
 * Wrap a world coordinate into [0, size).
 * @param {number} value
 * @param {number} size
 */
export function wrapCoord(value, size) {
  let v = value % size;
  if (v < 0) v += size;
  return v;
}

/**
 * Shortest wrapped delta from a to b on a periodic domain.
 * @param {number} a
 * @param {number} b
 * @param {number} size
 */
export function wrapDelta(a, b, size) {
  let d = b - a;
  if (d > size * 0.5) d -= size;
  if (d < -size * 0.5) d += size;
  return d;
}

/**
 * @param {number} seed
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(maxExclusive) {
      return Math.floor(this.next() * maxExclusive);
    },
  };
}
