// section-init.js — Runs inside each section iframe after HTML is loaded.
// Triggers Paged.js pagination and signals completion to the parent frame.
//
// Page breaks are now handled at markdown parse time (render-pipeline.js emits
// <div class="page-break"> directly). Heading orphan prevention is handled
// purely via CSS (break-after: avoid on h1-h4 in pdf.css). No DOM manipulation
// needed before Paged.js runs.
//
// Expects window.__gen to be set before this runs.

(async function() {
  // Run Paged.js pagination
  // Wrapped in try/catch: if this iframe was removed from the DOM mid-render
  // (due to a newer render superseding it), Paged.js will throw when trying
  // to measure detached elements. That's expected — the result is stale anyway.
  try {
    var paged = new Paged.Previewer();
    var flow = await paged.preview();
    var pages = (flow && flow.total) || document.querySelectorAll(".pagedjs_page").length;
    window.parent.postMessage({
      type: "section-ready",
      gen: window.__gen,
      pages: pages
    }, "*");
  } catch(e) {
    if (!document.defaultView) return; // iframe was detached, silently bail
    throw e;
  }
})();
