/**
 * Snapshot modal: moment description with copy/close; pauses sim while open.
 * @param {HTMLElement} container
 * @param {{ onCopy?: () => void }} [opts]
 */
export function createSnapshotModal(container, opts = {}) {
  container.className = "snapshot-modal";
  container.hidden = true;
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "true");
  container.setAttribute("aria-label", "快照");

  container.innerHTML = `
    <div class="snapshot-modal__backdrop" data-action="close"></div>
    <div class="snapshot-modal__dialog">
      <header class="snapshot-modal__header">
        <h2 class="snapshot-modal__title">快照</h2>
        <div class="snapshot-modal__actions">
          <button type="button" class="snapshot-modal__btn" id="snapshot-copy">复制</button>
          <button type="button" class="snapshot-modal__btn snapshot-modal__btn--close" id="snapshot-close">关闭</button>
        </div>
      </header>
      <div class="snapshot-modal__body" id="snapshot-body"></div>
    </div>
  `;

  const bodyEl = container.querySelector("#snapshot-body");
  const btnCopy = container.querySelector("#snapshot-copy");
  const btnClose = container.querySelector("#snapshot-close");
  const backdrop = container.querySelector(".snapshot-modal__backdrop");

  /** @type {(() => void) | null} */
  let onCloseHandler = null;
  /** @type {string} */
  let currentText = "";

  function close() {
    container.hidden = true;
    onCloseHandler?.();
    onCloseHandler = null;
  }

  /**
   * @param {string} narrative - shown in modal body
   * @param {{ onClose?: () => void, copyText?: string }} [opts]
   */
  function show(narrative, opts = {}) {
    currentText = opts.copyText ?? narrative;
    onCloseHandler = opts.onClose ?? null;
    if (bodyEl) bodyEl.textContent = narrative;
    container.hidden = false;
  }

  btnClose?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  btnCopy?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentText);
      if (btnCopy) {
        const prev = btnCopy.textContent;
        btnCopy.textContent = "已复制";
        setTimeout(() => {
          btnCopy.textContent = prev;
        }, 1200);
      }
      opts.onCopy?.();
    } catch {
      if (bodyEl) {
        const range = document.createRange();
        range.selectNodeContents(bodyEl);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  });

  return { show, close, isOpen: () => !container.hidden };
}
