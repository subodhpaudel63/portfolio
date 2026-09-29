const P = {
  arr: "fa-solid fa-arrow-right",
  mail: "fa-solid fa-envelope",
  phone: "fa-solid fa-phone",
  pin: "fa-solid fa-location-dot",
  gh: "fa-brands fa-github",
  in: "fa-brands fa-linkedin-in",
  cap: "fa-solid fa-graduation-cap",
  code: "fa-solid fa-code",
  user: "fa-solid fa-share-nodes",
};
const ic = (n) => `<i class="i ${P[n]}" aria-hidden="true"></i>`;
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const page = location.pathname.split("/").pop() || "index.html";
const links = [
  ["index", "Home"],
  ["about", "About"],
  ["projects", "Projects"],
  ["skills", "Skills"],
  ["contact", "Contact"],
]
  .map(
    ([f, t]) =>
      `<a href="${f}.html"${page === f + ".html" ? ' class="on"' : ""}>${t}</a>`,
  )
  .join("");
const soc = `<a href="https://github.com/" aria-label="GitHub">${ic("gh")}</a><a href="https://www.linkedin.com/" aria-label="LinkedIn">${ic("in")}</a><a href="mailto:subodhpaudel63@gmail.com" aria-label="Email">${ic("mail")}</a>`;
const logo = '<a href="index.html" class="logo"><b>SP</b>Subodh Paudel</a>';
$("#hd").innerHTML =
  `<div class="wrap nav">${logo}<nav class="links">${links}</nav><div class="nav-actions"><button class="theme-toggle" type="button" aria-label="Switch to light theme"><i class="fa-solid fa-sun"></i></button><a href="#" class="btn dark sm" download>Download CV</a><button class="menu" aria-label="Toggle menu"><i class="fa-solid fa-bars"></i></button></div></div>`;
$("#ft").innerHTML =
  `<div class="wrap footer-grid"><div class="footer-brand">${logo}<p class="sm">BITM Student and Web Developer from Pokhara, Nepal.</p><p class="footer-copy">Building clean, useful digital experiences with purpose.</p></div><div><h3>Let's Connect</h3><p class="sm">Have a project or idea in mind?</p><a class="footer-mail" href="mailto:subodhpaudel63@gmail.com">subodhpaudel63@gmail.com</a><div class="soc">${soc}</div></div></div><div class="wrap cp">© ${new Date().getFullYear()} Subodh Paudel. All rights reserved.</div>`;
$(".menu").onclick = () => $("#hd .links").classList.toggle("open");
const themeToggle = $(".theme-toggle"),
  savedTheme = localStorage.getItem("portfolio-theme");
if (savedTheme === "dark") document.body.classList.add("dark");
const updateThemeToggle = () => {
  const dark = document.body.classList.contains("dark");
  themeToggle.innerHTML = `<i class="fa-solid fa-${dark ? "sun" : "moon"}"></i>`;
  themeToggle.setAttribute(
    "aria-label",
    `Switch to ${dark ? "light" : "dark"} theme`,
  );
};
updateThemeToggle();
themeToggle.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "portfolio-theme",
    document.body.classList.contains("dark") ? "dark" : "light",
  );
  updateThemeToggle();
};

$$("[data-projects]").forEach(
  (el) =>
    (el.innerHTML = PROJECTS.slice(0, +el.dataset.limit || 99)
      .map(
        (p, i) =>
          `<article class="card" data-c="${p[3]}"><div class="thumb" style="background-image:url('${p[6] || `assets/images/projects/${i + 1}.png`}'),linear-gradient(135deg,${p[4]},#94a3b8)"></div><h3>${p[0]}</h3><p class="sm">${p[1]}</p><p class="project-desc">${p[7] || ""}</p><div class="tags">${p[2].map((t) => `<span class="tag">${t}</span>`).join("")}<a class="go" href="${p[5] || "#"}"${p[5] ? ' target="_blank" rel="noopener"' : ""} aria-label="View ${p[0]}${p[5] ? " live preview" : ""}">${ic("arr")}</a></div></article>`,
      )
      .join("")),
);
$$("[data-skills]").forEach(
  (el) =>
    (el.innerHTML = SKILLS.map(
      ([a, n, d, c], i) =>
        `<div class="card sk"><span class="ico" style="--c:${c}"><i class="${a}"></i></span><h3>${n}</h3><p>${d}</p></div>`,
    ).join("")),
);
$$("[data-i]").forEach((e) => (e.outerHTML = ic(e.dataset.i)));
$$("[data-soc]").forEach((e) => (e.innerHTML = soc));

const F = {
  "Web Apps": "web",
  "UI/UX": "ux",
  "HTML/CSS/JS": "stack",
  Database: "db",
};
$$(".pill").forEach(
  (b) =>
    (b.onclick = () => {
      $$(".pill").forEach((x) => x.classList.toggle("on", x === b));
      const c = F[b.textContent];
      $$("[data-c]").forEach((k) => {
        k.hidden = !!c && !k.dataset.c.includes(c);
      });
    }),
);

const f = $("#cf");
if (f)
  f.onsubmit = (e) => {
    e.preventDefault();
    const d = new FormData(f);
    location.href = `mailto:subodhpaudel63@gmail.com?subject=${encodeURIComponent("Portfolio enquiry from " + d.get("name"))}&body=${encodeURIComponent(d.get("message") + "\n\n" + d.get("email"))}`;
    $("button", f).textContent = "Opening your mail app…";
  };
