(() => {
  const pothi = document.getElementById("pothi");
  if (!pothi || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const stage = pothi.closest(".book");
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    pothi.style.setProperty("--rz", (-18 + x * 14).toFixed(2) + "deg");
    pothi.style.setProperty("--rx", (56 - y * 10).toFixed(2) + "deg");
  });
  stage.addEventListener("pointerleave", () => { pothi.style.removeProperty("--rz"); pothi.style.removeProperty("--rx"); });
})();
