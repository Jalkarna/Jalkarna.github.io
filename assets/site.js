(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const recent = () => { try { return JSON.parse(localStorage.getItem("pothi.recent") || "[]"); } catch (e) { return []; } };
  const href = (r) => "/" + r.slug + "/" + r.ch + "/" + (r.v ? r.v + "/" : "");
  const where = (r) => cap(r.chapter || "chapter") + " " + r.ch + (r.v ? ", " + r.ch + "." + r.v : "");
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return "just now";
    if (m < 60) return m + " minutes ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    const d = Math.round(h / 24);
    return d + (d === 1 ? " day ago" : " days ago");
  };

  /* home: continue reading */
  const rail = $("continue-rail");
  if (rail) {
    const items = recent();
    if (items.length) {
      rail.innerHTML = items.slice(0, 4).map((r) => '<a class="resume" href="' + href(r) + '"><span class="r-sa" lang="sa">' + esc(r.title_sa) +
        '</span><span class="r-t">' + esc(r.title) + '</span><span class="r-w">' + esc(where(r)) + '</span><span class="r-a">' + ago(r.at) + "</span></a>").join("");
      $("continue").hidden = false;
    }
  }

  /* text overview: continue button and go-to form */
  const cont = $("continue-btn");
  if (cont) {
    const r = recent().find((x) => x.slug === cont.dataset.slug);
    if (r) { cont.href = href(r); cont.textContent = "Continue at " + (r.v ? r.ch + "." + r.v : cap(r.chapter || "chapter") + " " + r.ch); cont.hidden = false; }
  }
  const jump = document.querySelector("form.jump");
  if (jump) {
    const counts = jump.dataset.chapters.split(",").map(Number);
    jump.addEventListener("submit", (e) => {
      e.preventDefault();
      const s = jump.ref.value.trim().replace(/[०-९]/g, (d) => "०१२३४५६७८९".indexOf(d));
      const m = s.match(/^(\d{1,3})(?:\s*[.:,\s]\s*(\d{1,3}))?$/);
      const ch = m && +m[1], v = m && m[2] ? +m[2] : null;
      if (!m || !counts[ch - 1] || (v && (v < 1 || v > counts[ch - 1]))) {
        $("jump-msg").textContent = m && counts[ch - 1] ? "That one has " + counts[ch - 1] + " verses." : "Use a number like 2 or 2.164.";
        return;
      }
      location.href = "/" + jump.dataset.slug + "/" + ch + "/" + (v ? v + "/" : "");
    });
  }

  /* search page */
  const out = $("search-results");
  if (out) {
    const q = new URLSearchParams(location.search).get("q") || "";
    $("search-q").value = q;
    document.querySelectorAll(".site-find input").forEach((i) => { i.value = q; });
    if (q.trim()) run(q.trim());
  }

  async function run(q) {
    const status = $("search-status");
    status.textContent = "Searching…";
    const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const needle = fold(q);
    const cat = await fetch("/data/catalogue.json").then((r) => r.json());
    const sections = [];
    const titles = cat.texts.filter((t) => fold(t.title + " " + t.title_sa + " " + t.summary + " " + t.category).includes(needle) || t.title_sa.includes(q));
    const arts = cat.articles.filter((a) => fold(a.title + " " + a.summary).includes(needle));
    if (titles.length || arts.length) {
      sections.push('<section class="block"><h2>Titles</h2><ul class="hits">' +
        titles.map((t) => '<li><a href="/' + t.slug + '/"><b><span lang="sa">' + esc(t.title_sa) + "</span> " + esc(t.title) + "</b><span>" + esc(t.summary) + "</span></a></li>").join("") +
        arts.map((a) => '<li><a href="/articles/' + a.slug + '/"><b>' + esc(a.title) + "</b><span>" + esc(a.summary) + "</span></a></li>").join("") + "</ul></section>");
    }
    const ref = q.replace(/[०-९]/g, (d) => "०१२३४५६७८९".indexOf(d)).match(/^(\d{1,3})\s*[.:,\s]\s*(\d{1,3})$/);
    let total = titles.length + arts.length;
    for (const t of cat.texts) {
      const rows = await fetch("/" + t.slug + "/data/search.json").then((r) => r.json());
      const hits = [];
      if (ref) { const x = rows.find((r) => r[0] === +ref[1] && r[1] === +ref[2]); if (x) hits.push([x, esc(x[2])]); }
      for (const r of rows) {
        if (hits.length >= 60) break;
        for (const [i, cls] of [[2, "iast"], [3, "en"]]) {
          const text = r[i] || "", f = fold(text), at = f.indexOf(needle);
          if (needle.length > 1 && at >= 0) {
            const s = Math.max(0, at - 70), e = Math.min(text.length, at + needle.length + 110);
            hits.push([r, '<span class="' + cls + '">' + (s ? "…" : "") + esc(text.slice(s, at)) + "<mark>" + esc(text.slice(at, at + needle.length)) + "</mark>" + esc(text.slice(at + needle.length, e)) + (e < text.length ? "…" : "") + "</span>"]);
            break;
          }
        }
      }
      total += hits.length;
      if (hits.length) {
        sections.push('<section class="block"><div class="block-head"><h2><a href="/' + t.slug + '/">' + esc(t.title) + '</a> <span lang="sa">' + esc(t.title_sa) + "</span></h2><span class=\"count\">" + (hits.length >= 60 ? "60+" : hits.length) + "</span></div>" +
          '<ul class="hits">' + hits.map(([r, html]) => '<li><a href="/' + t.slug + "/" + r[0] + "/" + r[1] + '/"><b>' + r[0] + "." + r[1] + "</b>" + html + "</a></li>").join("") + "</ul></section>");
      }
    }
    status.textContent = total ? (total === 1 ? "1 result" : total.toLocaleString("en") + " results") + " for “" + q + "”" : "Nothing in the library matches “" + q + "”.";
    out.innerHTML = sections.join("");
  }
})();
