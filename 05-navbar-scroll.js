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
