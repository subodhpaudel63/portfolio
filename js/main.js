// Behaviour only. Header, footer and icons live in the HTML so nothing pops in after load.
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const email = "subodhpaudel0000@gmail.com";
const arrow = '<i class="i fa-solid fa-arrow-right" aria-hidden="true"></i>';

$$("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
// Download CV buttons use CV_URL from data.js
$$("[data-cv]").forEach((a) => (a.href = CV_URL));

// Mobile menu
const menu = $(".menu"),
  nav = $("#site-nav");
const setMenu = (open) => {
  nav.classList.toggle("open", open);
  menu.setAttribute("aria-expanded", open);
  menu.innerHTML = `<i class="fa-solid fa-${open ? "xmark" : "bars"}"></i>`;
};
menu.onclick = () => setMenu(!nav.classList.contains("open"));
nav.addEventListener("click", (e) => e.target.closest("a") && setMenu(false));
addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));
addEventListener("click", (e) => !e.target.closest("#hd") && setMenu(false));
matchMedia("(min-width: 761px)").addEventListener("change", () => setMenu(false));

// Theme (initial class is applied by the inline script at the top of <body>; icons swap in CSS)
const themeToggle = $(".theme-toggle");
const syncTheme = () =>
  themeToggle.setAttribute("aria-label", `Switch to ${document.body.classList.contains("dark") ? "light" : "dark"} theme`);
syncTheme();
themeToggle.onclick = () => {
  const html = document.documentElement;
  html.classList.add("theme-anim");
  const dark = document.body.classList.toggle("dark");
  try { localStorage.setItem("portfolio-theme", dark ? "dark" : "light"); } catch (e) {}
  syncTheme();
  setTimeout(() => html.classList.remove("theme-anim"), 400);
};

// Projects & skills from data.js
const ext = 'target="_blank" rel="noopener noreferrer"';
const projectCard = (p, i) => {
  const live = p[5],
    repo = p[8] || `${GITHUB_URL}?tab=repositories`,
    bg = `background:linear-gradient(135deg,${p[4]},#94a3b8)`,
    img = `<img src="${p[6] || `assets/images/projects/${i + 1}.webp`}" alt="Screenshot of ${p[0]}" width="1000" height="750" loading="lazy" decoding="async" onerror="this.remove()">`;
  return `<article class="card" data-c="${p[3]}">${live ? `<a class="thumb" href="${live}" ${ext} tabindex="-1" aria-hidden="true" style="${bg}">${img}</a>` : `<div class="thumb" style="${bg}">${img}</div>`}<h3>${p[0]}</h3><p class="sm">${p[1]}</p><p class="project-desc">${p[7] || ""}</p><div class="tags">${p[2].map((t) => `<span class="tag">${t}</span>`).join("")}</div><div class="plinks">${live ? `<a class="pbtn primary" href="${live}" ${ext} aria-label="Open live demo of ${p[0]} (new tab)"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>Live Demo</a>` : ""}<a class="pbtn" href="${repo}" ${ext} aria-label="View ${p[0]} source code on GitHub (new tab)"><i class="fa-brands fa-github" aria-hidden="true"></i>GitHub</a></div></article>`;
};
$$("[data-projects]").forEach((el) => (el.innerHTML = PROJECTS.slice(0, +el.dataset.limit || 99).map(projectCard).join("")));
$$("[data-skills]").forEach(
  (el) =>
    (el.innerHTML = SKILLS.map(
      ([a, n, d, c]) => `<div class="card sk"><span class="ico" style="--c:${c}"><i class="${a}"></i></span><h3>${n}</h3><p>${d}</p></div>`,
    ).join("")),
);

// Project filters
const F = { "Web Apps": "web", "UI/UX": "ux", "HTML/CSS/JS": "stack", Database: "db" };
const cards = $$("[data-c]"),
  tagsOf = (k) => k.dataset.c.split(" ");
$$(".pill").forEach((b) => {
  const c = F[b.textContent];
  if (c && !cards.some((k) => tagsOf(k).includes(c))) b.remove(); // only offer filters that have projects
});
const grid = $("[data-projects]:not([data-limit])"),
  empty = document.createElement("p");
empty.className = "empty";
empty.hidden = true;
empty.textContent = "No projects in this category yet.";
grid?.append(empty);
$$(".pill").forEach((b) => {
  b.setAttribute("aria-pressed", b.classList.contains("on"));
  b.onclick = () => {
    $$(".pill").forEach((x) => {
      x.classList.toggle("on", x === b);
      x.setAttribute("aria-pressed", x === b);
    });
    const c = F[b.textContent];
    let shown = 0;
    cards.forEach((k) => {
      const show = !c || tagsOf(k).includes(c);
      if (show && k.hidden) {
        k.classList.add("pop");
        k.addEventListener("animationend", () => k.classList.remove("pop"), { once: true });
      }
      k.hidden = !show;
      shown += show;
    });
    empty.hidden = shown > 0;
  };
});

// Contact form: posts JSON to the PHP endpoint (CONTACT_API) with a signed CSRF token.
// Without CONTACT_API it falls back to opening the visitor's mail app.
const f = $("#cf");
if (f) {
  const btn = $("button", f),
    label = btn.innerHTML,
    api = typeof CONTACT_API === "string" ? CONTACT_API : "",
    status = document.createElement("p");
  status.setAttribute("role", "status");
  btn.after(status);
  let token = "";

  const setStatus = (msg, kind = "") => {
    status.className = "form-status " + kind;
    status.textContent = msg; // textContent: server text can never inject HTML
  };
  const showErrors = (errs = {}) =>
    ["name", "email", "message"].forEach((n) => {
      const input = f.elements[n];
      let el = f.querySelector(`[data-err="${n}"]`);
      if (!el) {
        el = document.createElement("small");
        el.className = "err";
        el.id = `err-${n}`;
        el.dataset.err = n;
        input.after(el);
      }
      el.textContent = errs[n] || "";
      input.setAttribute("aria-invalid", errs[n] ? "true" : "false");
      errs[n] ? input.setAttribute("aria-describedby", el.id) : input.removeAttribute("aria-describedby");
    });
  const getToken = async () => {
    const r = await fetch(`${api}?action=token`, { headers: { Accept: "application/json" } });
    token = (await r.json()).token || "";
  };
  if (api) getToken().catch(() => {});

  const viaMailto = (d) => {
    btn.disabled = true;
    btn.textContent = "Opening your mail app…";
    setStatus("");
    status.className = "form-status";
    status.innerHTML = `If nothing opened, email me directly at <a href="mailto:${email}">${email}</a>.`;
    location.href = `mailto:${email}?subject=${encodeURIComponent("Portfolio enquiry from " + d.name)}&body=${encodeURIComponent(d.message + "\n\n" + d.email)}`;
    setTimeout(() => { btn.disabled = false; btn.innerHTML = label; }, 3000);
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    showErrors();
    const d = Object.fromEntries(new FormData(f));
    if (!api) return viaMailto(d);

    btn.disabled = true;
    btn.textContent = "Sending…";
    setStatus("");
    const startedAt = Date.now();
    const send = () =>
      fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ name: d.name, email: d.email, message: d.message, website: d.website || "" }),
      });
    try {
      if (!token) await getToken();
      let r = await send(),
        j = await r.json().catch(() => ({}));
      if (!r.ok && ["bad_token", "expired_token"].includes(j.code)) {
        await getToken(); // token expired while the page was open: refresh once and retry
        r = await send();
        j = await r.json().catch(() => ({}));
      }
      if (r.ok && j.ok) {
        f.reset();
        setStatus(j.message || "Thanks! Your message has been sent.", j.email_sent === false ? "bad" : "ok");
      } else {
        if (j.errors) showErrors(j.errors);
        setStatus(j.message || "Something went wrong. Please try again.", "bad");
      }
    } catch (err) {
      status.className = "form-status bad";
      status.innerHTML = `Couldn't reach the server. Please email me at <a href="mailto:${email}">${email}</a>.`;
    } finally {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 700 - (Date.now() - startedAt))));
      btn.disabled = false;
      btn.innerHTML = label;
    }
  };
}
