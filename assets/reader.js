(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const SLUG = document.body.dataset.slug;
  const BASE = "/" + SLUG;
  const DIGITS = "०१२३४५६७८९";
  const deva = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const pane = $("pane"), page = $("page"), audio = $("audio"), player = $("player");
  const cache = {};
  let meta = null, current = null, route = { ch: null, v: null }, spyVerse = null, pinned = null, followUntil = 0, userScrollAt = 0;
  let CH = ["chapter", "chapters"], VS = ["verse", "verses"];

  const get = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
  const chapterData = (n) => (cache[n] ||= get(BASE + "/data/" + String(n).padStart(2, "0") + ".json"));
  const info = (n) => meta.chapters.find((c) => c.n === n);
  const pathOf = (ch, v) => BASE + "/" + (ch ? ch + "/" : "") + (v ? v + "/" : "");

  function parse(path) {
    const parts = path.split("/").filter(Boolean);
    if (parts[0] !== SLUG) return { ch: null, v: null };
    return { ch: parts[1] ? Number(parts[1]) : null, v: parts[2] ? Number(parts[2]) : null };
  }

  /* ── layers: Devanāgarī, IAST and each translation, each can be hidden ── */
  let layers = { sa: true, iast: true };
  function layerList() {
    return [["sa", "Devanāgarī", "अ"], ["iast", "IAST", "IAST"]].concat(meta.translations.map((t) => [t.id, t.label, t.label.slice(0, 2)]));
  }
  function applyLayers() {
    document.documentElement.dataset.layers = Object.keys(layers).filter((k) => layers[k]).join(" ");
    for (const box of [$("layers-bar"), $("layers-side")]) {
      box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(!!layers[b.dataset.layer])));
    }
    try { localStorage.setItem("pothi.layers", JSON.stringify(layers)); } catch (e) { /* private mode */ }
    reanchor();
  }
  function setupLayers() {
    const saved = (() => { try { return JSON.parse(localStorage.getItem("pothi.layers") || "null"); } catch (e) { return null; } })();
    layers = {};
    for (const [id] of layerList()) layers[id] = saved && id in saved ? !!saved[id] : true;
    if (!Object.values(layers).some(Boolean)) layers.sa = true;
    $("layers-bar").innerHTML = layerList().map(([id, label, short]) =>
      '<button type="button" data-layer="' + id + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"' + (id === "sa" ? ' lang="sa"' : "") + ">" + esc(short) + "</button>").join("");
    $("layers-side").innerHTML = '<span class="layers-h">Show</span>' + layerList().map(([id, label]) =>
      '<button type="button" data-layer="' + id + '">' + esc(label) + "</button>").join("");
    for (const box of [$("layers-bar"), $("layers-side")]) {
      box.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-layer]");
        if (!b) return;
        const id = b.dataset.layer;
        layers[id] = !layers[id];
        if (!Object.values(layers).some(Boolean)) layers[id] = true;
        applyLayers();
      });
    }
    applyLayers();
  }

  /* ── rendering ─────────────────────────────────────────── */
  function words(text, heard) {
    if (!heard) return esc(text);
    return text.split(/(\s+)/).map((w) => (/^\s+$/.test(w) || !w ? w : '<span class="w">' + esc(w) + "</span>")).join("");
  }

  function translationsOf(n, x) {
    return meta.translations.map((t) => {
      const id = t.id, ref = x[id + "_ref"] ? '<span class="src">' + esc(t.by.split(" ").pop()) + " " + esc(x[id + "_ref"]) + "</span>" : "";
      if (x[id + "_with"]) return '<p class="tr tr-' + id + ' tr-with" lang="en">Translated together with <a href="' + pathOf(n, x[id + "_with"]) + '">' + n + "." + x[id + "_with"] + "</a>.</p>";
      if (!x[id]) return "";
      const joint = x[id + "_joint"] ? '<span class="src">' + n + "." + x[id + "_joint"][0] + "–" + x[id + "_joint"][1] + " together</span>" : "";
      return '<p class="tr tr-' + id + '" lang="en">' + esc(x[id]) + ref + joint + "</p>";
    }).join("");
  }

  async function renderChapter(n) {
    if (current && current.n === n) return;
    page.innerHTML = '<p class="loading">Opening ' + CH[0] + " " + n + "…</p>";
    const d = await chapterData(n);
    const c = info(n);
    const heard = new Set(d.audio ? d.audio.verses : []);
    const prev = info(n - 1), next = info(n + 1);
    const out = ['<header class="ch-head"><p class="eyebrow"><a href="' + BASE + '/">' + esc(meta.title) + "</a> · " + cap(CH[0]) + " " + n + " of " + meta.chapters.length + "</p>" +
      '<h1 lang="sa">' + d.title + "</h1>" +
      '<p class="sub">' + esc(c.title_iast) + " · " + c.count + " " + VS[1] + (c.audio ? ' · <span class="heard">' + c.audio.verses.length + " recited</span>" : "") + "</p>" +
      (c.topic ? '<p class="topic">' + esc(c.topic) + "</p>" : "") + "</header>"];
    for (const x of d.verses) {
      const h = heard.has(x.v);
      out.push('<article class="verse' + (h ? " heard" : "") + '" id="v' + x.v + '" data-v="' + x.v + '">' +
        '<a class="num" href="' + pathOf(n, x.v) + '">' + n + "." + x.v + "</a>" +
        (h ? '<button class="play-from" data-v="' + x.v + '" aria-label="Play ' + VS[0] + " " + n + "." + x.v + '">Play</button>' : "") +
        '<div class="orig"><p class="sa" lang="sa"><span class="l" data-line="0">' + words(x.sa[0], h) + '\u00a0<span class="end">।</span></span>' +
        '<span class="l" data-line="1">' + words(x.sa[1], h) + '\u00a0<span class="end">॥\u2009' + deva(x.v) + "\u2009॥</span></span></p>" +
        '<p class="iast" lang="sa-Latn"><span>' + esc(x.iast[0]) + "</span><span>" + esc(x.iast[1]) + "</span></p></div>" +
        translationsOf(n, x) + "</article>");
    }
    out.push('<nav class="ch-foot" aria-label="' + cap(CH[1]) + '">' +
      (prev ? '<a class="prev" href="' + pathOf(prev.n) + '"><small>Previous ' + CH[0] + '</small><span>' + cap(CH[0]) + " " + prev.n + ' <span lang="sa">' + prev.title + "</span></span></a>" : "<span></span>") +
      (next ? '<a class="next" href="' + pathOf(next.n) + '"><small>Next ' + CH[0] + '</small><span>' + cap(CH[0]) + " " + next.n + ' <span lang="sa">' + next.title + "</span></span></a>" : '<a class="next" href="' + BASE + '/"><small>End of the text</small><span>Back to the overview</span></a>') + "</nav>");
    const cr = meta.credits;
    out.push('<section class="credits"><p>' + esc(cr.sanskrit) + ' Source for this ' + CH[0] + ': <a href="' + esc(d.source_url) + '">' + esc(d.source_url.replace(/^https?:\/\//, "")) + "</a>, " +
      '<a href="' + esc(cr.licence_url) + '">' + esc(cr.licence) + "</a>.</p>" +
      meta.translations.map((t) => "<p>" + esc(t.label) + ": " + esc(t.credit) + ' Alignment notes are on the <a href="' + BASE + '/#src-h">overview</a>.</p>').join("") +
      (d.audio && cr.audio ? "<p>" + esc(cr.audio) + "</p>" : "") + "</section>");
    page.innerHTML = out.join("");
    current = d;
    spyVerse = null;
    spy();
  }

  function renderMissing(what) {
    current = null;
    page.innerHTML = '<div class="missing"><h1>' + esc(what) + '</h1><p>It is not in this text. <a href="' + BASE + '/">See all ' + CH[1] + "</a>.</p></div>";
  }

  /* ── navigation ────────────────────────────────────────── */
  function chapterItems(ch) {
    return meta.chapters.map((c) => '<li><a href="' + pathOf(c.n) + '"' + (c.n === ch ? ' aria-current="page"' : "") +
      '><span class="n">' + c.n + '</span><span lang="sa">' + c.title + '</span><span class="c">' + c.count +
      (c.audio ? '<span class="dot" title="Has recitation"></span>' : "") + "</span></a></li>").join("");
  }
  function nav() {
    const ch = route.ch;
    $("chapters").innerHTML = chapterItems(ch);
    $("switch-list").innerHTML = chapterItems(ch);
    $("switch-label").textContent = ch ? cap(CH[0]) + " " + ch : cap(CH[1]);
    const prev = ch && info(ch - 1), next = ch && info(ch + 1);
    for (const [el, c, word] of [[$("prev"), prev, "Previous"], [$("next"), next, "Next"]]) {
      if (c) { el.href = pathOf(c.n); el.removeAttribute("aria-disabled"); el.setAttribute("aria-label", word + " " + CH[0] + ", " + c.n); el.title = word + " " + CH[0]; }
      else { el.removeAttribute("href"); el.setAttribute("aria-disabled", "true"); }
    }
    const vw = $("verses-wrap");
    if (current) {
      const heard = new Set(current.audio ? current.audio.verses : []);
      $("verses-h").textContent = cap(VS[1]) + " of " + CH[0] + " " + current.n;
      $("verses").innerHTML = current.verses.map((x) => '<a href="' + pathOf(current.n, x.v) + '" data-v="' + x.v + '"' +
        (heard.has(x.v) ? ' class="heard"' : "") + ">" + x.v + "</a>").join("");
      vw.hidden = false;
    } else vw.hidden = true;
  }

  function markGrid(v) {
    const grid = $("verses");
    const old = grid.querySelector("[aria-current]");
    if (old) old.removeAttribute("aria-current");
    const a = grid.querySelector('[data-v="' + v + '"]');
    if (!a) return;
    a.setAttribute("aria-current", "true");
    const box = a.closest(".side-scroll"), top = a.offsetTop - box.offsetTop;
    if (top < box.scrollTop + 40 || top > box.scrollTop + box.clientHeight - 60) box.scrollTop = top - box.clientHeight / 2;
  }

  function scrollToVerse(v, smooth) {
    const el = $("v" + v);
    if (!el) return false;
    pane.scrollTo({ top: el.offsetTop - 16, behavior: smooth ? "smooth" : "instant" });
    return el;
  }

  function titleFor(ch, v) {
    return meta.title + (ch ? (v ? " " + ch + "." + v : ", " + CH[0] + " " + ch) : "") + " · Pothī";
  }

  function remember(ch, v) {
    if (!ch) return;
    try {
      const all = JSON.parse(localStorage.getItem("pothi.recent") || "[]").filter((x) => x.slug !== SLUG);
      all.unshift({ slug: SLUG, title: meta.title, title_sa: meta.title_sa, ch, v: v || null, chapter: CH[0], at: Date.now() });
      localStorage.setItem("pothi.recent", JSON.stringify(all.slice(0, 8)));
    } catch (e) { /* private mode */ }
  }

  let spyTimer = 0;
  async function go(path, opts = {}) {
    const r = parse(path);
    if (!r.ch) { location.href = BASE + "/"; return; }
    if (opts.push !== false && location.pathname !== path) history.pushState(null, "", path);
    route = r;
    closeNav();
    closeSwitch();
    if (!info(r.ch)) { renderMissing(cap(CH[0]) + " " + r.ch); nav(); return; }
    const same = current && current.n === r.ch;
    await renderChapter(r.ch);
    loadAudio();
    if (r.v && !$("v" + r.v)) { renderMissing(cap(VS[0]) + " " + r.ch + "." + r.v); nav(); return; }
    pinned = r.v || null;
    clearTimeout(spyTimer);
    if (r.v) {
      spyVerse = r.v;
      const el = scrollToVerse(r.v, same);
      page.querySelectorAll(".is-target").forEach((x) => x.classList.remove("is-target"));
      el.classList.add("is-target");
      setTimeout(() => el.classList.remove("is-target"), 2400);
    } else if (!same || opts.top) pane.scrollTop = 0;
    nav();
    if (r.v) markGrid(r.v);
    document.title = titleFor(r.ch, r.v);
    remember(r.ch, r.v);
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.hash || !parse(url.pathname).ch) return;
    e.preventDefault();
    go(url.pathname, { top: true });
  });
  addEventListener("popstate", () => go(location.pathname, { push: false }));

  function spy() {
    if (!current || pinned) return;
    const line = pane.getBoundingClientRect().top + 48;
    let v = null;
    for (const el of page.querySelectorAll(".verse")) {
      if (el.getBoundingClientRect().top <= line) v = Number(el.dataset.v); else break;
    }
    if (pane.scrollTop < 8) v = null;
    if (v === spyVerse) return;
    spyVerse = v;
    if (v) markGrid(v);
    document.title = titleFor(current.n, v);
    clearTimeout(spyTimer);
    spyTimer = setTimeout(() => {
      const want = pathOf(current.n, v);
      if (location.pathname !== want) history.replaceState(null, "", want);
      route.v = v;
      remember(current.n, v);
    }, 500);
  }
  const unpin = () => { pinned = null; };
  ["wheel", "touchstart", "pointerdown"].forEach((t) => pane.addEventListener(t, unpin, { passive: true }));
  addEventListener("keydown", (e) => { if (!e.target.closest("input")) unpin(); });
  function reanchor() { if (pinned) scrollToVerse(pinned, false); }
  document.fonts.ready.then(reanchor);
  addEventListener("resize", reanchor);
  pane.addEventListener("scroll", () => { if (Date.now() > followUntil) userScrollAt = Date.now(); requestAnimationFrame(spy); }, { passive: true });

  /* ── chapter switcher ──────────────────────────────────── */
  function closeSwitch() { $("switch-pop").hidden = true; $("switch-btn").setAttribute("aria-expanded", "false"); }
  $("switch-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const open = $("switch-pop").hidden;
    $("switch-pop").hidden = !open;
    $("switch-btn").setAttribute("aria-expanded", String(open));
    if (open) { const cur = $("switch-list").querySelector("[aria-current]"); if (cur) cur.scrollIntoView({ block: "nearest" }); (cur || $("switch-list").querySelector("a")).focus(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".switch")) closeSwitch(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeSwitch(); });

  /* ── search and jump ───────────────────────────────────── */
  const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  function foldMap(s) {
    let out = "", map = [];
    for (let i = 0; i < s.length; i++) { const f = fold(s[i]); out += f; for (let k = 0; k < f.length; k++) map.push(i); }
    return { out, map };
  }
  function mark(text, needle) {
    const f = foldMap(text), at = f.out.indexOf(needle);
    if (at < 0) return null;
    const s = f.map[at], e = f.map[at + needle.length - 1] + 1;
    const from = Math.max(0, s - 60), to = Math.min(text.length, e + 90);
    return (from ? "…" : "") + esc(text.slice(from, s)) + "<mark>" + esc(text.slice(s, e)) + "</mark>" + esc(text.slice(e, to)) + (to < text.length ? "…" : "");
  }
  function refOf(q) {
    const s = q.trim().replace(/[०-९]/g, (d) => DIGITS.indexOf(d));
    let m = s.match(/^(\d{1,3})\s*[.:,\s]\s*(\d{1,3})$/);
    if (m) return { ch: +m[1], v: +m[2] };
    m = s.match(/^(\d{1,3})$/);
    if (m) return current ? { ch: current.n, v: +m[1], alt: { ch: +m[1], v: null } } : { ch: +m[1], v: null };
    return null;
  }
  const valid = (r) => r && info(r.ch) && (!r.v || r.v <= info(r.ch).count);
  let searchSeq = 0;
  async function search(q) {
    const wrap = $("results-wrap"), list = $("results");
    $("q-bar").value = $("q-side").value = q;
    if (!q.trim()) { wrap.hidden = true; $("nav-wrap").hidden = false; return; }
    wrap.hidden = false; $("nav-wrap").hidden = true;
    if (!matchMedia("(max-width: 900px)").matches) openNav(false);
    const ref = refOf(q);
    const refs = [ref, ref && ref.alt].filter(valid);
    if (refs.length) {
      $("results-h").textContent = "Go to";
      list.innerHTML = refs.map((r) => '<li><a href="' + pathOf(r.ch, r.v) + '"><b>' + (r.v ? cap(VS[0]) + " " + r.ch + "." + r.v : cap(CH[0]) + " " + r.ch) + "</b></a></li>").join("");
      return;
    }
    if (q.trim().length < 2) { $("results-h").textContent = "Results"; list.innerHTML = ""; return; }
    const seq = ++searchSeq;
    $("results-h").textContent = "Searching…";
    const all = await Promise.all(meta.chapters.map((c) => chapterData(c.n)));
    if (seq !== searchSeq) return;
    const needle = fold(q.trim()), raw = q.trim(), hits = [];
    outer: for (const d of all) {
      for (const x of d.verses) {
        const iast = x.iast.join(" / ");
        let html = mark(iast, needle);
        if (!html && x.sa.join(" ").includes(raw)) html = esc(iast);
        if (!html) for (const t of meta.translations) { if (x[t.id] && (html = mark(x[t.id], needle))) { html = '<i class="en">' + html + "</i>"; break; } }
        if (html) hits.push({ ch: d.n, v: x.v, html });
        if (hits.length >= 80) break outer;
      }
    }
    $("results-h").textContent = hits.length ? (hits.length >= 80 ? "First 80 results" : hits.length + (hits.length === 1 ? " result" : " results")) : "Nothing matches";
    list.innerHTML = hits.map((h) => '<li><a href="' + pathOf(h.ch, h.v) + '"><b>' + h.ch + "." + h.v + "</b><span>" + h.html + "</span></a></li>").join("");
  }
  let qTimer = 0;
  for (const id of ["q-bar", "q-side"]) {
    const input = $(id);
    input.addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(() => search(input.value), 180); });
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; search(""); input.blur(); } });
  }
  for (const id of ["find-bar", "find-side"]) {
    $(id).addEventListener("submit", async (e) => {
      e.preventDefault();
      await search(e.target.querySelector("input").value);
      const first = $("results").querySelector("a");
      if (first) { const p = new URL(first.href).pathname; search(""); go(p, { top: true }); }
    });
  }
  $("results").addEventListener("click", (e) => { if (e.target.closest("a")) setTimeout(() => search(""), 0); });

  /* ── drawer (narrow screens) ───────────────────────────── */
  function openNav(open) {
    if (!matchMedia("(max-width: 900px)").matches) return;
    document.body.classList.toggle("nav-open", open);
    $("menu").setAttribute("aria-expanded", String(open));
  }
  const closeNav = () => openNav(false);
  $("menu").addEventListener("click", () => openNav(!document.body.classList.contains("nav-open")));
  $("scrim").addEventListener("click", closeNav);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeNav(); });

  /* ── recitation and karaoke ────────────────────────────── */
  let cues = [], audioCh = null, raf = 0, activeVerse = null;
  function heardSummary() {
    return meta.chapters.filter((c) => c.audio).map((c) => {
      const v = c.audio.verses;
      return '<a href="' + pathOf(c.n, v[0]) + '">' + c.n + "." + v[0] + (v.length > 1 ? "–" + c.n + "." + v[v.length - 1] : "") + "</a>";
    }).join(" and ");
  }
  function loadAudio() {
    const d = current && current.audio ? current : null;
    if (!d) {
      if (audioCh !== null) { audio.pause(); audio.removeAttribute("src"); audio.load(); audioCh = null; }
      cues = [];
      player.classList.add("empty");
      $("pp").disabled = true;
      const any = meta.chapters.some((c) => c.audio);
      $("now-a").textContent = any ? "No recitation for " + CH[0] + " " + (current ? current.n : "") + " yet" : "No recitation for this text yet";
      $("now-b").innerHTML = any ? "Recited so far: " + heardSummary() : "";
      return;
    }
    if (audioCh === d.n) return;
    audioCh = d.n;
    cues = d.audio.cues.map(([v, line, start, end]) => ({ v, line, start, end }));
    audio.src = d.audio.src;
    player.classList.remove("empty");
    $("pp").disabled = false;
    const vs = d.audio.verses;
    $("now-a").textContent = cap(CH[0]) + " " + d.n + ", " + VS[1] + " " + vs[0] + "–" + vs[vs.length - 1];
    $("now-b").textContent = meta.credits.audio ? meta.credits.audio.split(".")[0] : "";
    $("t-dur").textContent = fmt(d.audio.duration);
    $("seek").value = 0; $("t-cur").textContent = "0:00";
  }

  function cueAt(t) {
    let found = null;
    for (const c of cues) { if (c.start <= t) found = c; else break; }
    return found;
  }

  function paint() {
    const t = audio.currentTime;
    const c = cueAt(t);
    if (audio.duration) $("seek").value = (t / audio.duration) * 100;
    $("t-cur").textContent = fmt(t);
    if (!c || !current || current.n !== audioCh) return;
    const el = $("v" + c.v);
    if (!el) return;
    if (activeVerse !== el) {
      if (activeVerse) { activeVerse.classList.remove("is-playing"); activeVerse.querySelectorAll(".sung").forEach((w) => w.classList.remove("sung")); }
      activeVerse = el;
      el.classList.add("is-playing");
      $("now-a").textContent = cap(VS[0]) + " " + audioCh + "." + c.v;
      if (Date.now() - userScrollAt > 4000) {
        const top = el.offsetTop - pane.scrollTop;
        if (top < 40 || top + el.offsetHeight > pane.clientHeight - 40) { followUntil = Date.now() + 1200; pane.scrollTo({ top: el.offsetTop - pane.clientHeight * 0.2, behavior: "smooth" }); }
      }
    }
    el.querySelectorAll(".l").forEach((line) => {
      const n = Number(line.dataset.line), ws = line.querySelectorAll(".w");
      if (n < c.line) { ws.forEach((w) => w.classList.add("sung")); return; }
      if (n > c.line) { ws.forEach((w) => w.classList.remove("sung")); return; }
      const total = [...ws].reduce((s, w) => s + w.textContent.length, 0);
      const done = Math.min(1, (t - c.start) / (c.end - c.start)) * total;
      let acc = 0;
      ws.forEach((w) => { acc += w.textContent.length * 0.5; w.classList.toggle("sung", acc <= done || t >= c.end); acc += w.textContent.length * 0.5; });
    });
  }
  function loop() { paint(); if (!audio.paused) raf = requestAnimationFrame(loop); }
  audio.addEventListener("play", () => { unpin(); $("pp-icon").setAttribute("d", "M4 2.5h3v11H4zM9 2.5h3v11H9z"); $("pp").setAttribute("aria-label", "Pause recitation"); cancelAnimationFrame(raf); loop(); });
  audio.addEventListener("pause", () => { $("pp-icon").setAttribute("d", "M4 2.5v11l9.5-5.5z"); $("pp").setAttribute("aria-label", "Play recitation"); paint(); });
  audio.addEventListener("ended", () => { if (activeVerse) activeVerse.classList.remove("is-playing"); activeVerse = null; });
  audio.addEventListener("loadedmetadata", () => { $("t-dur").textContent = fmt(audio.duration); });
  audio.addEventListener("seeked", paint);
  $("pp").addEventListener("click", () => { if (audio.paused) { userScrollAt = 0; audio.play(); } else audio.pause(); });
  $("seek").addEventListener("input", (e) => { if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration; });
  const rates = [1, 1.25, 0.75];
  $("rate").addEventListener("click", () => { const r = rates[(rates.indexOf(audio.playbackRate) + 1) % rates.length]; audio.playbackRate = r; $("rate").textContent = r + "×"; });
  function playFrom(v, line) {
    const c = cues.find((x) => x.v === v && (line === undefined || x.line === line));
    if (!c) return;
    audio.currentTime = c.start; userScrollAt = Date.now(); audio.play();
  }
  page.addEventListener("click", (e) => {
    const b = e.target.closest(".play-from");
    if (b) { playFrom(Number(b.dataset.v)); return; }
    const l = e.target.closest(".heard .l");
    if (l && !getSelection().toString()) playFrom(Number(l.closest(".verse").dataset.v), Number(l.dataset.line));
  });
  addEventListener("keydown", (e) => {
    if (e.target.closest("input, button, a, video")) return;
    if (e.code === "Space" && !$("pp").disabled) { e.preventDefault(); $("pp").click(); }
    if ((e.key === "[" || e.key === "]") && route.ch) { const c = info(route.ch + (e.key === "]" ? 1 : -1)); if (c) go(pathOf(c.n), { top: true }); }
  });

  /* ── start ─────────────────────────────────────────────── */
  get(BASE + "/data/text.json").then((m) => {
    meta = m;
    CH = m.divisions.chapter; VS = m.divisions.verse;
    $("bar-text").textContent = m.title;
    $("chapters-h").textContent = cap(CH[1]);
    $("q-bar").placeholder = $("q-side").placeholder = "Search, or go to " + CH[0] + "." + VS[0];
    $("meta").innerHTML = "<p>" + m.chapters.length + " " + CH[1] + ", " + m.verses.toLocaleString("en") + " " + VS[1] + ". " + esc(m.layers.join(", ")) + ".</p>" +
      "<p>" + esc(m.credits.sanskrit) + ' <a href="' + esc(m.credits.licence_url) + '">' + esc(m.credits.licence) + "</a>.</p>" +
      m.translations.map((t) => "<p>" + esc(t.label) + ": " + esc(t.credit) + "</p>").join("") +
      (m.credits.audio ? "<p>" + esc(m.credits.audio) + " Verse numbers in colour have a recitation.</p>" : "") +
      '<p><a href="' + BASE + '/">About this text and its sources</a></p>';
    setupLayers();
    let path = location.pathname;
    if (!path.endsWith("/")) path += "/";
    return go(path, { push: false });
  }).catch((err) => { page.innerHTML = '<p class="loading">The text could not be loaded (' + esc(String(err.message || err)) + "). Try reloading.</p>"; });
})();
