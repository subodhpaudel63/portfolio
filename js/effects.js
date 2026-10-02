// Scroll effects: header state, one-time staggered reveals, animated counters, card glow
const H = $("#hd"),
  reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let raf = 0;
const tick = () => {
  raf = 0;
  H.classList.toggle("sc", scrollY > 24);
};
addEventListener("scroll", () => raf || (raf = requestAnimationFrame(tick)), { passive: true });
tick();

// Reveal when an element scrolls into view; reset once it has fully left the viewport,
// so the animation plays again whenever the user scrolls back to it (up or down).
const watch = (els, min, on, off) => {
  const show = new IntersectionObserver(
    (es) => es.forEach((e) => e.isIntersecting && e.intersectionRatio >= min && on(e.target)),
    { threshold: min, rootMargin: "0px 0px -6% 0px" },
  );
  const hide = new IntersectionObserver((es) => es.forEach((e) => !e.isIntersecting && off(e.target)));
  els.forEach((el) => (show.observe(el), hide.observe(el)));
};

// Keep in sync with the reveal selector list in css/theme.css
const REVEAL = ".hero > *, .split > *, .cg > *, .sec > :not(.g3, .g4, .pills), .stats > *, .row, main > .h, main > .lead, .about-actions, .g3 > :not(.empty), .g4 > *, .pills > *, .tl > *, .footer-grid > *";

// html.js is set in <head> only when reveals are allowed (IntersectionObserver + no reduced-motion).
if (document.documentElement.classList.contains("js")) {
  const els = $$(REVEAL);
  els.forEach((el) => el.style.setProperty("--d", Math.min([...el.parentElement.children].indexOf(el), 5) * 70 + "ms"));
  watch(els, 0.12, (el) => el.classList.add("is-visible"), (el) => el.classList.remove("is-visible", "is-done"));
  // .is-done hands hover transitions back to the element once its reveal has finished.
  addEventListener("transitionend", (e) => {
    if (e.propertyName === "opacity" && !e.pseudoElement && e.target.classList?.contains("is-visible")) e.target.classList.add("is-done");
  });

  const ease = (t) => 1 - (1 - t) ** 3,
    setNum = (c, n) => (c.textContent = n + (c.dataset.suffix || "")),
    counters = $$("[data-count]");
  counters.forEach((c) => setNum(c, 0));
  watch(counters, 0.6, (c) => {
    if (c._t) return; // already counting / counted
    const to = +c.dataset.count, t0 = (c._t = performance.now());
    const step = (now) => {
      if (c._t !== t0) return; // reset while running
      const p = Math.min(Math.max((now - t0) / 1200, 0), 1);
      setNum(c, Math.round(to * ease(p)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, (c) => { c._t = 0; setNum(c, 0); });
}
window.__rv = true; // tells the <head> safety timer that reveals are running

addEventListener("pointermove", (e) => {
  const c = e.target.closest?.(".card");
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty("--mx", e.clientX - r.left + "px");
  c.style.setProperty("--my", e.clientY - r.top + "px");
}, { passive: true });
