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

   v4: marks the navbar item for the SECTION you're in, not just the
   exact page. Super only adds its .active class on an exact path
   match, so opening /work/email-marketing left nothing selected and
   the navbar lost its "you are here" indicator the moment you went one
   level deep. This adds .active to any item whose href is the current
   path OR a parent segment of it — the same class the CSS already
   styles, so no new styling is needed.
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

  /* ------------------------------------------------------------------
     SECTION-AWARE NAV HIGHLIGHTING

     Matching is segment-aware: an item's href matches when it IS the
     current path, or when the path continues with a "/" after it. So
     /work lights up on /work and /work/email-marketing, but never on
     /workshop. The logo (href="/") and any absolute/external link are
     skipped, since "/" is a prefix of everything.

     Items we mark are tagged data-dj-section-active so they can be
     un-marked on navigation without disturbing an .active class Super
     set itself.

     Needs its own observer: the one above watches a single attribute
     on <html>, while this watches the navbar being rebuilt. Super
     re-renders it after load and on client-side navigation, which
     wipes the class — without re-applying, this works on first paint
     and then silently stops.
     ------------------------------------------------------------------ */
  var lastPath = null;
  var navPending = false;

  function currentPath() {
    return window.location.pathname.replace(/\/+$/, '') || '/';
  }

  function clearOurMarks() {
    var marked = document.querySelectorAll('[data-dj-section-active]');
    for (var i = 0; i < marked.length; i++) {
      marked[i].classList.remove('active');
      marked[i].removeAttribute('data-dj-section-active');
    }
  }

  function markSection() {
    navPending = false;
    var path = currentPath();

    // On a change of page, drop the marks from the previous one first.
    if (path !== lastPath) {
      clearOurMarks();
      lastPath = path;
    }

    var items = document.querySelectorAll(
      '.super-navbar__item, .super-navigation-menu__item'
    );

    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      var link = el.tagName === 'A' ? el : el.querySelector('a');
      var href = (link || el).getAttribute('href');

      // Skip the logo, anchors, and anything pointing off-site.
      if (!href || href === '/' || href.charAt(0) === '#') continue;
      if (href.indexOf('//') === 0 || href.indexOf('://') !== -1) continue;

      href = href.replace(/\/+$/, '');

      if (path === href || path.indexOf(href + '/') === 0) {
        if (!el.classList.contains('active')) {
          el.classList.add('active');
          el.setAttribute('data-dj-section-active', '');
        }
      }
    }
  }

  function scheduleMark() {
    if (!navPending) {
      navPending = true;
      requestAnimationFrame(markSection);
    }
  }

  markSection();
  document.addEventListener('DOMContentLoaded', markSection);
  window.addEventListener('load', markSection);
  window.addEventListener('pageshow', markSection);
  window.addEventListener('popstate', markSection);

  // Super rebuilds the navbar after load and on client-side
  // navigation; re-apply whenever its subtree changes.
  new MutationObserver(scheduleMark).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
