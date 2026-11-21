(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const BASE = "/manusmriti";
  const DIGITS = "०१२३४५६७८९";
  const deva = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const pane = $("pane"), page = $("page"), audio = $("audio"), player = $("player");
  const cache = {};
  let meta = null, current = null, route = { ch: null, v: null }, spyVerse = null, followUntil = 0, userScrollAt = 0;

  const get = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
  const chapterData = (n) => (cache[n] ||= get(BASE + "/data/" + String(n).padStart(2, "0") + ".json"));
  const info = (n) => meta.chapters.find((c) => c.n === n);
  const pathOf = (ch, v) => BASE + "/" + (ch ? ch + "/" : "") + (v ? v + "/" : "");

  function parse(path) {
    const parts = path.split("/").filter(Boolean);
    if (parts[0] !== "manusmriti") return { ch: null, v: null };
    return { ch: parts[1] ? Number(parts[1]) : null, v: parts[2] ? Number(parts[2]) : null };
  }

  /* ── rendering ─────────────────────────────────────────── */
  function credits() {
    return '<section class="credits"><p>Text: Sanskrit Wikisource contributors, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. ' +
      "Transliteration (IAST) generated from the Devanāgarī. Recitation where present: " +
      '<a href="https://github.com/prathoshap/vagdhenu">Vāgdhenu</a>, a synthetic voice, not a traditional chanting lineage.</p></section>';
  }

  function heardSummary() {
    return meta.chapters.filter((c) => c.audio).map((c) => {
      const v = c.audio.verses;
      return '<a href="' + pathOf(c.n, v[0]) + '">' + c.n + "." + v[0] + (v.length > 1 ? "–" + c.n + "." + v[v.length - 1] : "") + "</a>";
    }).join(" and ");
  }

  function renderOverview() {
    current = null;
    const toc = meta.chapters.map((c) => '<a href="' + pathOf(c.n) + '"><span class="n">' + c.n + '</span><span lang="sa">' + c.title +
      '</span><span class="c">' + c.count + " ślokas" + (c.audio ? ' · <span class="heard">' + c.audio.verses.length + " recited</span>" : "") + "</span></a>").join("");
    page.innerHTML = '<div class="overview"><h1><span lang="sa">' + meta.title + '</span><span class="t">' + meta.title_iast + "</span></h1>" +
      '<p class="lede">Twelve adhyāyas and ' + meta.verses.toLocaleString("en") + " ślokas in the received Sanskrit, each with its transliteration. " +
      "Choose an adhyāya, or go straight to a verse with the search field.</p>" +
      '<nav class="toc" aria-label="Adhyāyas">' + toc + "</nav>" +
      (meta.film ? '<figure class="film"><video controls preload="none" playsinline src="' + meta.film + '"></video><figcaption>A 74-second film of adhyāya 12, ślokas 1–6, made from the same text and recitation.</figcaption></figure>' : "") +
      credits() + "</div>";
  }

  function words(text, heard) {
    if (!heard) return esc(text);
    return text.split(/(\s+)/).map((w) => (/^\s+$/.test(w) || !w ? w : '<span class="w">' + esc(w) + "</span>")).join("");
  }

  async function renderChapter(n) {
    if (current && current.n === n) return;
    page.innerHTML = '<p class="loading">Opening adhyāya ' + n + "…</p>";
    const d = await chapterData(n);
    const c = info(n);
    const heard = new Set(d.audio ? d.audio.verses : []);
    const out = ['<header class="ch-head"><p>Manusmṛti, adhyāya ' + n + '</p><h1 lang="sa">' + d.title + '</h1><p class="sub">' +
      esc(c.title_iast) + " · " + c.count + " ślokas</p></header>"];
    for (const x of d.verses) {
      const h = heard.has(x.v);
      out.push('<article class="verse' + (h ? " heard" : "") + '" id="v' + x.v + '" data-v="' + x.v + '">' +
        '<a class="num" href="' + pathOf(n, x.v) + '">' + n + "." + x.v + "</a>" +
        (h ? '<button class="play-from" data-v="' + x.v + '" aria-label="Play śloka ' + n + "." + x.v + '">Play</button>' : "") +
        '<p class="sa" lang="sa"><span class="l" data-line="0">' + words(x.sa[0], h) + '\u00a0<span class="end">।</span></span>' +
        '<span class="l" data-line="1">' + words(x.sa[1], h) + '\u00a0<span class="end">॥\u2009' + deva(x.v) + "\u2009॥</span></span></p>" +
        '<p class="iast" lang="sa-Latn"><span>' + esc(x.iast[0]) + "</span><span>" + esc(x.iast[1]) + "</span></p></article>");
    }
    const prev = info(n - 1), next = info(n + 1);
    out.push('<nav class="ch-foot">' + (prev ? '<a href="' + pathOf(prev.n) + '">← Adhyāya ' + prev.n + "</a>" : "<span></span>") +
      (next ? '<a href="' + pathOf(next.n) + '">Adhyāya ' + next.n + " →</a>" : "<span></span>") + "</nav>");
    out.push('<section class="credits"><p>Source: <a href="https://sa.wikisource.org/w/index.php?oldid=' + d.revision +
      '">Sanskrit Wikisource, revision ' + d.revision + '</a>, by its contributors, under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. ' +
      "IAST generated from the Devanāgarī." + (d.audio ? ' Recitation: <a href="https://github.com/prathoshap/vagdhenu">Vāgdhenu</a>, synthetic.' : "") + "</p></section>");
    page.innerHTML = out.join("");
    current = d;
    spy();
  }

  function renderMissing(what) {
    current = null;
    page.innerHTML = '<div class="overview"><h1><span class="t">' + esc(what) + '</span></h1><p class="lede">It is not in this text. <a href="' + BASE + '/">See all adhyāyas</a>.</p></div>';
  }

  /* ── navigation ────────────────────────────────────────── */
  function nav() {
    const ch = route.ch;
    $("chapters").innerHTML = meta.chapters.map((c) => '<li><a href="' + pathOf(c.n) + '"' + (c.n === ch ? ' aria-current="page"' : "") +
      '><span class="n">' + c.n + '</span><span lang="sa">' + c.title + '</span><span class="c">' + c.count +
      (c.audio ? '<span class="dot" title="Has recitation"></span>' : "") + "</span></a></li>").join("");
    const vw = $("verses-wrap");
    if (current) {
      const heard = new Set(current.audio ? current.audio.verses : []);
      $("verses-h").textContent = "Ślokas of adhyāya " + current.n;
      $("verses").innerHTML = current.verses.map((x) => '<a href="' + pathOf(current.n, x.v) + '" data-v="' + x.v + '"' +
        (heard.has(x.v) ? ' class="heard"' : "") + ">" + x.v + "</a>").join("");
      vw.hidden = false;
    } else vw.hidden = true;
    crumbs();
  }

  function crumbs(v) {
    const deep = route.ch ? " up" : "";
    const parts = ['<a class="up" href="/">Library</a>', '<span class="sep up">›</span>', '<a class="' + deep + '" href="' + BASE + '/">Manusmṛti</a>'];
    if (route.ch) parts.push('<span class="sep up">›</span>', '<a href="' + pathOf(route.ch) + '">Adhyāya ' + route.ch + "</a>");
    if (route.ch && v) parts.push('<span class="sep">›</span>', "<span>" + route.ch + "." + v + "</span>");
    $("crumbs").innerHTML = parts.join(" ");
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

  async function go(path, opts = {}) {
    const r = parse(path);
    if (opts.push !== false && location.pathname !== path) history.pushState(null, "", path);
    route = r;
    closeNav();
    if (r.ch && !info(r.ch)) { renderMissing("Adhyāya " + r.ch); nav(); return; }
    if (!r.ch) { renderOverview(); pane.scrollTop = 0; }
    else {
      const same = current && current.n === r.ch;
      await renderChapter(r.ch);
      loadAudio();
      if (r.v && !$("v" + r.v)) { renderMissing("Śloka " + r.ch + "." + r.v); nav(); return; }
      if (r.v) {
        const el = scrollToVerse(r.v, same);
        page.querySelectorAll(".is-target").forEach((x) => x.classList.remove("is-target"));
        el.classList.add("is-target");
        setTimeout(() => el.classList.remove("is-target"), 2400);
      } else if (!same || opts.top) pane.scrollTop = 0;
    }
    nav();
    if (r.v) { markGrid(r.v); crumbs(r.v); }
    document.title = r.ch ? "Manusmṛti " + r.ch + (r.v ? "." + r.v : "") + " · Pothī" : "Manusmṛti · Pothī";
    if (!r.ch) loadAudio();
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(BASE + "/")) return;
    e.preventDefault();
    go(url.pathname, { top: true });
  });
  addEventListener("popstate", () => go(location.pathname, { push: false }));

  /* scrollspy: the verse at the reading line becomes the current one */
  let spyTimer = 0;
  function spy() {
    if (!current) return;
    const line = pane.getBoundingClientRect().top + 48;
    let v = null;
    for (const el of page.querySelectorAll(".verse")) {
      if (el.getBoundingClientRect().top <= line) v = Number(el.dataset.v); else break;
    }
    if (pane.scrollTop < 8) v = null;
    if (v === spyVerse) return;
    spyVerse = v;
    if (v) markGrid(v);
    crumbs(v);
    document.title = "Manusmṛti " + current.n + (v ? "." + v : "") + " · Pothī";
    clearTimeout(spyTimer);
    spyTimer = setTimeout(() => {
      const want = pathOf(current.n, v);
      if (location.pathname !== want) history.replaceState(null, "", want);
      route.v = v;
    }, 500);
  }
  pane.addEventListener("scroll", () => { if (Date.now() > followUntil) userScrollAt = Date.now(); requestAnimationFrame(spy); }, { passive: true });

  /* ── search and jump ───────────────────────────────────── */
  const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  function foldMap(s) {
    let out = "", map = [];
    for (let i = 0; i < s.length; i++) { const f = fold(s[i]); out += f; for (let k = 0; k < f.length; k++) map.push(i); }
    return { out, map };
  }
  function refOf(q) {
    const m = q.trim().replace(/[०-९]/g, (d) => DIGITS.indexOf(d)).match(/^(\d{1,2})\s*[.:,\s]\s*(\d{1,3})$/);
    if (m) return { ch: +m[1], v: +m[2] };
    const c = q.trim().replace(/[०-९]/g, (d) => DIGITS.indexOf(d)).match(/^(\d{1,2})$/);
    return c ? { ch: +c[1], v: null } : null;
  }
  let lastQuery = "", searchSeq = 0;
  async function search(q) {
    lastQuery = q;
    const wrap = $("results-wrap"), list = $("results");
    $("q-bar").value = $("q-side").value = q;
    if (!q.trim()) { wrap.hidden = true; $("nav-wrap").hidden = false; return; }
    wrap.hidden = false; $("nav-wrap").hidden = true;
    if (matchMedia("(max-width: 900px)").matches === false) openNav(false);
    const ref = refOf(q);
    if (ref && info(ref.ch) && (!ref.v || ref.v <= info(ref.ch).count)) {
      $("results-h").textContent = "Go to";
      list.innerHTML = '<li><a href="' + pathOf(ref.ch, ref.v) + '"><b>' + (ref.v ? ref.ch + "." + ref.v : "Adhyāya " + ref.ch) + "</b></a></li>";
      return;
    }
    if (q.trim().length < 2) { $("results-h").textContent = "Results"; list.innerHTML = ""; return; }
    const seq = ++searchSeq;
    $("results-h").textContent = "Searching…";
    const all = await Promise.all(meta.chapters.map((c) => chapterData(c.n)));
    if (seq !== searchSeq) return;
    const needle = fold(q.trim()), hits = [];
    for (const d of all) {
      for (const x of d.verses) {
        const iast = x.iast.join(" / "), sa = x.sa.join(" ");
        const f = foldMap(iast), at = f.out.indexOf(needle);
        if (at >= 0) {
          const s = f.map[at], e = f.map[at + needle.length - 1] + 1;
          hits.push({ ch: d.n, v: x.v, html: esc(iast.slice(0, s)) + "<mark>" + esc(iast.slice(s, e)) + "</mark>" + esc(iast.slice(e)) });
        } else if (sa.includes(q.trim())) hits.push({ ch: d.n, v: x.v, html: esc(iast) });
        if (hits.length >= 80) break;
      }
      if (hits.length >= 80) break;
    }
    $("results-h").textContent = hits.length ? (hits.length >= 80 ? "First 80 results" : hits.length + (hits.length === 1 ? " result" : " results")) : "No verse contains that";
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
  function loadAudio() {
    const d = current && current.audio ? current : null;
    if (!d) {
      if (audioCh !== null) { audio.pause(); audio.removeAttribute("src"); audio.load(); audioCh = null; }
      cues = [];
      player.classList.add("empty");
      $("pp").disabled = true;
      $("now-a").textContent = current ? "No recitation for adhyāya " + current.n + " yet" : "Recitation";
      $("now-b").innerHTML = "Recited so far: " + heardSummary();
      return;
    }
    if (audioCh === d.n) return;
    audioCh = d.n;
    cues = d.audio.cues.map(([v, line, start, end]) => ({ v, line, start, end }));
    audio.src = d.audio.src;
    player.classList.remove("empty");
    $("pp").disabled = false;
    const vs = d.audio.verses;
    $("now-a").textContent = "Adhyāya " + d.n + ", ślokas " + vs[0] + "–" + vs[vs.length - 1];
    $("now-b").textContent = "Vāgdhenu, synthetic voice";
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
      $("now-a").textContent = "Śloka " + audioCh + "." + c.v;
      if (Date.now() - userScrollAt > 4000) {
        const top = el.offsetTop - pane.scrollTop;
        if (top < 40 || top + el.offsetHeight > pane.clientHeight - 40) { followUntil = Date.now() + 1200; pane.scrollTo({ top: el.offsetTop - pane.clientHeight * 0.25, behavior: "smooth" }); }
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
  audio.addEventListener("play", () => { $("pp-icon").setAttribute("d", "M4 2.5h3v11H4zM9 2.5h3v11H9z"); $("pp").setAttribute("aria-label", "Pause recitation"); cancelAnimationFrame(raf); loop(); });
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
    if (e.code !== "Space" || e.target.closest("input, button, a, video") || $("pp").disabled) return;
    e.preventDefault(); $("pp").click();
  });

  /* ── start ─────────────────────────────────────────────── */
  get(BASE + "/data/text.json").then((m) => {
    meta = m;
    $("meta").innerHTML = "<p>" + m.chapters.length + " adhyāyas, " + m.verses.toLocaleString("en") + " ślokas, Devanāgarī with IAST.</p>" +
      "<p>Recited so far: " + heardSummary() + ". Verse numbers in red have a recitation.</p>" +
      '<p>Text: Sanskrit Wikisource contributors, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</p>';
    let path = location.pathname;
    if (!path.endsWith("/")) path += "/";
    return go(path, { push: false });
  }).catch((err) => { page.innerHTML = '<p class="lede">The text could not be loaded (' + esc(String(err.message || err)) + "). Try reloading.</p>"; });
})();
