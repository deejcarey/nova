/* ==========================================================================
   06-lightbox.js — Super's "lightbox with navigation" snippet, forked
   Based on https://sites.super.so/snippets/lightbox-with-navigation.js
   Replace Super's own <script> tag with this file.

   WHY THE FORK: the original collects EVERY visible .notion-image on
   the page into the gallery — including UI images: colored dividers,
   headshots, chart graphics. Thumbing through a gallery that contains
   a 4px divider ruins the flow. The original is hosted by Super and
   can't be edited, so this copy adds an exclusion step.

   HOW TO EXCLUDE AN IMAGE — any ONE of these:
     1. Give it a caption of "-" (a single hyphen) in Notion. This
        file hides that caption, so nothing shows on the page.
     2. Name the file with "-ui" in it (e.g. headshot-ui.png).
     3. Nothing: images under MIN_HEIGHT px tall are skipped
        automatically, which covers the dividers without any tagging.

   Everything else — paging, keyboard, swipe, history handling — is
   unchanged from Super's original.
   ========================================================================== */
(() => {
  if (window.__superGalleryLightboxInstalled) return;
  window.__superGalleryLightboxInstalled = true;

  /* ---- exclusion settings -------------------------------------------- */
  const MIN_HEIGHT = 24;          // images shorter than this are skipped
  const FLAG_CAPTION = '-';       // caption that marks an image as UI
  const FLAG_SRC = ['-ui', 'div-']; // filename fragments that mark UI images

  function captionFor(img) {
    const box = img.closest('.notion-image') || img.closest('figure');
    if (!box) return null;
    return box.querySelector('figcaption, [class*="caption"]');
  }

  function isExcluded(img) {
    const src = (img.currentSrc || img.src || '').toLowerCase();
    if (FLAG_SRC.some(f => src.includes(f))) return true;
    if (img.getBoundingClientRect().height < MIN_HEIGHT) return true;
    const cap = captionFor(img);
    if (cap && cap.textContent.trim() === FLAG_CAPTION) return true;
    return false;
  }

  // Hide any caption used purely as a flag, so it never shows on the page.
  function hideFlagCaptions() {
    document.querySelectorAll('.notion-image figcaption, .notion-image [class*="caption"]')
      .forEach(cap => {
        if (cap.textContent.trim() === FLAG_CAPTION) cap.style.display = 'none';
      });
  }
  hideFlagCaptions();

  const historyKey = '__superGalleryLightbox';
  const session = Math.random().toString(36).slice(2);
  const dialog = document.createElement('dialog');
  dialog.id = 'super-gallery-lightbox';
  dialog.setAttribute('aria-label', 'Image gallery');
  dialog.innerHTML = `
    <img class="sg-image" alt="" draggable="false">
    <button class="sg-close" type="button" aria-label="Close image gallery">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <button class="sg-prev" type="button" aria-label="Previous image">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6"/></svg>
    </button>
    <button class="sg-next" type="button" aria-label="Next image">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"/></svg>
    </button>
    <p class="sg-counter" role="status" aria-live="polite" aria-atomic="true"></p>
  `;
  document.body.appendChild(dialog);

  const image = dialog.querySelector('.sg-image');
  const closeButton = dialog.querySelector('.sg-close');
  const previousButton = dialog.querySelector('.sg-prev');
  const nextButton = dialog.querySelector('.sg-next');
  const counter = dialog.querySelector('.sg-counter');
  let gallery = [];
  let index = 0;
  let pageURL = '';
  let closing = false;
  let previousOverflow = '';
  let touchStart = null;

  function render() {
    image.src = gallery[index].src;
    image.alt = gallery[index].alt || `Image ${index + 1} of ${gallery.length}`;
    counter.textContent = `${index + 1} / ${gallery.length}`;
    previousButton.hidden = nextButton.hidden = gallery.length < 2;
  }

  function show() {
    render();
    if (dialog.open) return;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
  }

  function hide() {
    closing = false;
    touchStart = null;
    if (!dialog.open) return;
    dialog.close();
    image.removeAttribute('src');
    document.body.style.overflow = previousOverflow;
  }

  function step(direction) {
    if (!dialog.open || closing) return;
    index = (index + direction + gallery.length) % gallery.length;
    render();
  }

  function open(clickedImage) {
    if (closing || dialog.open) return;
    const root = clickedImage.closest('.notion-root') || document;
    const images = [...root.querySelectorAll('.notion-image img')]
      .filter(img => img.getClientRects().length && (img.currentSrc || img.src))
      .filter(img => !isExcluded(img));           // <-- the fork
    index = images.indexOf(clickedImage);
    if (index < 0) return;
    gallery = images.map(img => ({
      src: img.currentSrc || img.src,
      alt: img.alt === 'image' ? '' : img.alt
    }));
    pageURL = location.href;
    history.pushState({ ...history.state, [historyKey]: session }, '', pageURL);
    show();
  }

  function requestClose() {
    if (!dialog.open || closing) return;
    if (history.state?.[historyKey] === session && location.href === pageURL) {
      closing = true;
      history.back();
    } else {
      hide();
    }
  }

  document.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = event.target.closest?.('.notion-root .notion-image img');
    if (!target) return;
    if (isExcluded(target)) return;               // <-- excluded images ignore clicks
    event.preventDefault();
    event.stopPropagation();
    open(target);
  }, true);

  previousButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
  closeButton.addEventListener('click', requestClose);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) requestClose();
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Tab') {
      const buttons = [...dialog.querySelectorAll('button')].filter(button => !button.hidden);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  dialog.addEventListener('pointerdown', event => {
    touchStart = event.isPrimary && event.pointerType === 'touch' && event.target === image
      ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  dialog.addEventListener('pointerup', event => {
    if (!touchStart || touchStart.id !== event.pointerId) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      step(dx < 0 ? 1 : -1);
    }
  });
  dialog.addEventListener('pointercancel', () => { touchStart = null; });

  window.addEventListener('popstate', () => {
    if (history.state?.[historyKey] === session && location.href === pageURL && gallery.length) {
      closing = false;
      show();
    } else {
      hide();
    }
  });

  new MutationObserver(() => {
    if (dialog.open && location.href !== pageURL) hide();
    hideFlagCaptions();
  }).observe(document.body, { childList: true, subtree: true });
})();
