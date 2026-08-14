/**
 * Milestone danmaku: messages fly left-to-right across the canvas area.
 * @param {HTMLElement} container
 */
export function createMilestoneToast(container) {
  container.className = "danmaku-layer";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");

  let laneCursor = 0;

  /** @param {string} message */
  function show(message) {
    if (!message) return;

    const el = document.createElement("div");
    el.className = "danmaku-item";
    el.textContent = message;

    const lane = laneCursor % 9;
    laneCursor += 1;
    el.style.top = `${14 + lane * 6.5}%`;
    el.style.animationDuration = `${7.5 + (lane % 3) * 1.2}s`;
    el.style.animationDelay = `${lane * 0.04}s`;

    container.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  return { show };
}
