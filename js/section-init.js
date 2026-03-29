// section-init.js — Runs inside each section iframe.
// Handles page breaks, heading orphan prevention, then runs Paged.js and signals completion.
// Mermaid diagrams are pre-rendered in the MD phase (main page DOM), not here.
//
// Expects window.__sectionIndex and window.__sectionGen to be set before this runs.

(async function() {
  // ── Page break replacement ──
  document.querySelectorAll('.pdf-content p').forEach(function(p) {
    var t = p.textContent.trim();
    if (t === String.fromCharCode(92) + 'newpage' || t === '/newpage') {
      var pb = document.createElement('div');
      pb.className = 'page-break';
      p.replaceWith(pb);
    }
  });

  // ── Heading orphan prevention ──
  (function() {
    var headings = document.querySelectorAll('.pdf-content h2, .pdf-content h3, .pdf-content h4');
    var wrapped = new Set();
    headings.forEach(function(h) {
      if (wrapped.has(h)) return;
      var els = [h];
      var next = h.nextElementSibling;
      while (next && /^H[2-6]$/.test(next.tagName)) { els.push(next); wrapped.add(next); next = next.nextElementSibling; }
      if (next && !/^H[1-6]$/.test(next.tagName)) els.push(next);
      if (els.length < 2) return;
      var wrapper = document.createElement('div');
      wrapper.style.breakInside = 'avoid';
      wrapper.style.pageBreakInside = 'avoid';
      h.parentNode.insertBefore(wrapper, h);
      els.forEach(function(el) { wrapper.appendChild(el); });
    });
  })();

  // ── Run Paged.js ──
  // Wrapped in try/catch: if this iframe was removed from the DOM mid-render
  // (due to a newer render superseding it), Paged.js will throw when trying
  // to measure detached elements. That's expected — the result is stale anyway.
  try {
    var paged = new Paged.Previewer();
    await paged.preview();
  } catch(e) {
    if (!document.defaultView) return; // iframe was detached, silently bail
    throw e; // real error, re-throw
  }

  // ── Signal completion ──
  window.parent.postMessage({
    type: "section-ready",
    index: window.__sectionIndex,
    gen: window.__sectionGen,
    pages: document.querySelectorAll(".pagedjs_page").length
  }, "*");
})();
