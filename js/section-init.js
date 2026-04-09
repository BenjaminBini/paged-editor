// section-init.js — Runs inside each section iframe after HTML is loaded.
// Triggers Paged.js pagination and signals completion to the parent frame.
//
// Page breaks are now handled at markdown parse time (render-pipeline.js emits
// <div class="page-break"> directly). Heading orphan prevention is handled
// purely via CSS (break-after: avoid on h1-h4 in pdf.css). No DOM manipulation
// needed before Paged.js runs.
//
// Expects window.__gen to be set before this runs.
//
// NOTE: When persistent iframes are used (render.js), document.open/write/close
// resets the document while a previous render may still be running.  Paged.js
// will throw because its DOM nodes are detached.  We catch and silently discard
// those stale-render errors.

(async function() {
  const myGen = window.__gen;
  try {
    var paged = new Paged.Previewer();
    var flow = await paged.preview();
    var pages = (flow && flow.total) || document.querySelectorAll(".pagedjs_page").length;
    window.parent.postMessage({
      type: "section-ready",
      gen: myGen,
      pages: pages
    }, "*");
  } catch(e) {
    // Bail silently if:
    //  • the iframe was detached (document.defaultView is null), or
    //  • the document was reset mid-render by a newer document.write()
    //    (document.readyState is 'loading' or the body is gone).
    if (!document.defaultView) return;
    if (!document.body || document.readyState === "loading") return;
    throw e;
  }
})();
