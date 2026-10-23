/* ==========================================================================
   05-navbar-scroll.js — tells the CSS whether the page is scrolled
   Sets data-dj-nav="top" or "scrolled" on the <html> element. All the
   visual behavior lives in 02-design.css; this file only sets the label.
   Uses a data attribute rather than a class on purpose: Super/Next.js
   manages <html>'s classes (e.g. theme-dark), and could wipe ours.

   v2: Super rebuilds parts of the page just after it loads, which was
   removing the label — so the navbar fell back to its tinted/blurred
   default until the next scroll. The script now watches for its label
   being removed and puts it straight back, and re-checks once the page
   has fully loaded.

   v3: also publishes --dj-scrollbar, the width of the vertical
   scrollbar, on <html>. CSS has no way to measure that, and 100vw
   INCLUDES it — so a full-bleed element sized at 100vw overflows the
   page by exactly the scrollbar's width. The full-width hero image
   rule in 01-layout.css subtracts this to land exactly edge to edge.
   Falls back to 0px if this script never runs, which is the ordinary
   100vw behavior.
   ========================================================================== */
(function () {
  // How far (in px) the page must scroll before the navbar fades in.
  var THRESHOLD = 10;

  var root = document.documentElement;
  var pending = false;

  function scrollPosition() {
    return Math.max(
      window.scrollY || 0,
      root.scrollTop || 0,
      document.body ? document.body.scrollTop : 0
    );
  }

  function update() {
    pending = false;
    var state = scrollPosition() > THRESHOLD ? 'scrolled' : 'top';
    // Only writes when the value actually differs, so the watcher
    // below never triggers itself in a loop.
    if (root.getAttribute('data-dj-nav') !== state) {
      root.setAttribute('data-dj-nav', state);
    }
  }

  // The scrollbar's width: the gap between the window (which 100vw
  // measures) and the document's visible area (which content fills).
  function measureScrollbar() {
    var w = window.innerWidth - root.clientWidth;
    root.style.setProperty('--dj-scrollbar', (w > 0 ? w : 0) + 'px');
  }
  measureScrollbar();
  window.addEventListener('resize', measureScrollbar, { passive: true });
  window.addEventListener('load', measureScrollbar);

  // Check at most once per frame, however fast scroll events arrive.
  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(update);
    }
  }

  // capture:true catches scrolling no matter which element scrolls.
  window.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', update);
  window.addEventListener('load', update);
  document.addEventListener('DOMContentLoaded', update);

  // Watch the label: if anything removes or changes it, restore it.
  new MutationObserver(update).observe(root, {
    attributes: true,
    attributeFilter: ['data-dj-nav']
  });

  update();
})();
