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
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
        if (!entry.isIntersecting) return;

        entry.target.querySelectorAll("[data-count]").forEach((counter) => {
          if (counter.dataset.counted) return;
          counter.dataset.counted = "true";
          const target = Number(counter.dataset.count);
          const suffix = counter.dataset.suffix || "";
          if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
            counter.textContent = `${target}${suffix}`;
            return;
          }

          const start = performance.now();
          const update = (now) => {
            const progress = Math.min((now - start) / 1000, 1);
            counter.textContent = `${Math.floor(target * progress)}${suffix}`;
            if (progress < 1) requestAnimationFrame(update);
          };
          requestAnimationFrame(update);
        });
      });
    },
    { threshold: 0.12 },
  );

  if (
    !["projects.html", "skills.html"].includes(
      location.pathname.split("/").pop(),
    )
  )
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
