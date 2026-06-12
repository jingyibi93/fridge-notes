function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function attachDrag(element, note, board, onOpen) {
  let dragging = false;
  let moved = false;
  let pointerId = null;
  let startClientX = 0;
  let startClientY = 0;
  let startX = note.x;
  let startY = note.y;
  const dragThreshold = 8;

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest("button")) return;
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startX = Number(element.style.getPropertyValue("--x")) || note.x;
    startY = Number(element.style.getPropertyValue("--y")) || note.y;
    element.setPointerCapture(pointerId);
    const updated = window.FridgeStore.bringToFront(note.id);
    if (updated) element.style.setProperty("--z", updated.z);
  });

  element.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const deltaX = event.clientX - startClientX;
    const deltaY = event.clientY - startClientY;
    const distance = Math.hypot(deltaX, deltaY);
    if (!moved && distance < dragThreshold) return;

    if (!moved) {
      moved = true;
      element.classList.add("dragging");
    }
    event.preventDefault();
    const rect = board.getBoundingClientRect();
    const x = clamp(startX + (deltaX / rect.width) * 100, 12, 88);
    const y = clamp(startY + (deltaY / rect.height) * 100, 8, 90);
    element.style.setProperty("--x", x);
    element.style.setProperty("--y", y);
  });

  function finish(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    element.classList.remove("dragging");
    try {
      element.releasePointerCapture(pointerId);
    } catch (error) {}

    if (moved) {
      const x = Number(element.style.getPropertyValue("--x"));
      const y = Number(element.style.getPropertyValue("--y"));
      window.FridgeStore.updateNote(note.id, { x, y });
    } else {
      onOpen(note.id);
    }
  }

  element.addEventListener("pointerup", finish);
  element.addEventListener("pointercancel", finish);
}

window.FridgeDrag = { attachDrag };
