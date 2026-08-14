/**
 * Top-right milestone toast: 1s auto-hide, replaced by newer messages.
 * @param {HTMLElement} container
 */
export function createMilestoneToast(container) {
  container.className = "milestone-toast-wrap";

  const el = document.createElement("div");
  el.id = "milestone-toast";
  el.className = "milestone-toast";
  el.hidden = true;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  container.appendChild(el);

  /** @type {ReturnType<typeof setTimeout> | 0} */
  let timer = 0;

  /** @param {string} message */
  function show(message) {
    el.textContent = message;
    el.hidden = false;
    el.classList.remove("milestone-toast--fade");
    void el.offsetWidth;
    el.classList.add("milestone-toast--show");

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      el.classList.remove("milestone-toast--show");
      el.classList.add("milestone-toast--fade");
      timer = setTimeout(() => {
        el.hidden = true;
        el.classList.remove("milestone-toast--fade");
      }, 180);
    }, 1000);
  }

  return { show };
}
