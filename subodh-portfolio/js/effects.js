// Scroll effects: header colour, parallax, and card glow
const root = document.documentElement,
  H = $("#hd"),
  up = document.createElement("button");
up.className = "top";
up.setAttribute("aria-label", "Back to top");
up.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
up.onclick = () => scrollTo({ top: 0, behavior: "smooth" });
document.body.append(up);
let raf = 0;
const tick = () => {
  raf = 0;
  const y = scrollY;
  H.classList.toggle("sc", y > 24);
  up.classList.toggle("on", y > 500);
  root.style.setProperty("--sy", y);
};
addEventListener("scroll", () => raf || (raf = requestAnimationFrame(tick)), {
  passive: true,
});
tick();

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) =>
        entry.target.classList.toggle("is-visible", entry.isIntersecting),
      );
    },
    { threshold: 0.12 },
  );

  document
    .querySelectorAll("main > *, main .g3 > *, main .stats > *, main .tl > *")
    .forEach((element) => {
      element.classList.add("reveal");
      revealObserver.observe(element);
    });
}

addEventListener(
  "pointermove",
  (e) => {
    const c = e.target.closest?.(".card");
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", e.clientX - r.left + "px");
    c.style.setProperty("--my", e.clientY - r.top + "px");
  },
  { passive: true },
);
