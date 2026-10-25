/* ==========================================================================
   06-lightbox.js — Super's "lightbox with navigation" snippet, forked
   Based on https://sites.super.so/snippets/lightbox-with-navigation.js
   Replace Super's own <script> tag with this file.

   WHY THE FORK: the original collects EVERY visible .notion-image on
   the page into the gallery — including UI images: colored dividers,
   headshots, chart graphics. Thumbing through a gallery that contains
   a 4px divider ruins the flow. The original is hosted by Super and
   can't be edited, so this copy adds an exclusion step.

   IT ALSO TAGS IMAGES FOR CSS. CSS can't read caption text, so this
   script writes the result of each flag onto the image's container as
   a data attribute:
       data-nova-nolightbox   — skipped by the gallery
       data-nova-noborder     — image border suppressed (see 02-design.css)
   That way one flag syntax drives both behaviors.

   FLAG SYNTAX — put these in the image's CAPTION in Notion:
       -      UI image: no lightbox AND no border (the common case)
       -nl    no lightbox only (still gets a border)
       -nb    no border only (still opens in the lightbox) — charts
              like the A-Frame and flywheel, where a box fights the art
   Combine with a space: "-nl -nb" is the same as "-".
   A caption made only of flags is hidden, so nothing shows on the
   page. A caption with real text in it is left alone and displayed.

   Filenames still work too: anything containing "-ui" or "div-" is
   treated as "-". And any image under MIN_HEIGHT px tall is excluded
   automatically, which covers the dividers with no tagging at all.

   CAPTIONS IN THE OVERLAY: an image's Notion caption is carried into
   the lightbox and shown under the image (styled in 02-design.css).
   A caption that is only flags shows nothing, since it carries no
   meaning for a reader. Images without a caption show nothing and
   reserve no space.

   Everything else — paging, keyboard, swipe, history handling — is
   unchanged from Super's original.
   ========================================================================== */
(() => {
  if (window.__superGalleryLightboxInstalled) return;
  window.__superGalleryLightboxInstalled = true;

  /* ---- flags & exclusion settings ------------------------------------ */
  const MIN_HEIGHT = 24;             // images shorter than this: skip + no border
  const FLAG_ALL = '-';              // no lightbox AND no border
  const FLAG_NO_LIGHTBOX = '-nl';    // no lightbox only
  const FLAG_NO_BORDER = '-nb';      // no border only
  const FLAG_SRC = ['-ui', 'div-'];  // filename fragments treated as FLAG_ALL

  const FLAGS = [FLAG_ALL, FLAG_NO_LIGHTBOX, FLAG_NO_BORDER];

  function boxFor(img) {
    return img.closest('.notion-image') || img.closest('figure');
  }

  function captionFor(img) {
    const box = boxFor(img);
    return box ? box.querySelector('figcaption, [class*="caption"]') : null;
  }

  // Reads an image's flags from its caption, filename and size.
  function flagsFor(img) {
    const out = { noLightbox: false, noBorder: false, flagCaption: null };
    const src = (img.currentSrc || img.src || '').toLowerCase();

    if (FLAG_SRC.some(f => src.includes(f))) {
      out.noLightbox = out.noBorder = true;
    }
    if (img.getBoundingClientRect().height < MIN_HEIGHT) {
      out.noLightbox = out.noBorder = true;
    }

    const cap = captionFor(img);
    if (cap) {
      const tokens = cap.textContent.trim().split(/\s+/).filter(Boolean);
      // Only treat the caption as flags when EVERY token is a flag —
      // a real caption that happens to start with a dash stays visible.
      if (tokens.length && tokens.every(t => FLAGS.includes(t))) {
        out.flagCaption = cap;
        tokens.forEach(t => {
          if (t === FLAG_ALL) out.noLightbox = out.noBorder = true;
          if (t === FLAG_NO_LIGHTBOX) out.noLightbox = true;
          if (t === FLAG_NO_BORDER) out.noBorder = true;
        });
      }
    }
    return out;
  }

  function isExcluded(img) {
    return flagsFor(img).noLightbox;
  }

  // The caption to SHOW in the overlay. A caption made only of flags
  // carries no meaning for a reader, so it returns empty for those.
  function displayCaptionFor(img) {
    const f = flagsFor(img);
    if (f.flagCaption) return '';
    const cap = captionFor(img);
    return cap ? cap.textContent.trim() : '';
  }

  // Writes the flags onto the DOM so CSS can style off them, and hides
  // any caption that exists only to carry flags.
  function applyFlags() {
    document.querySelectorAll('.notion-image img').forEach(img => {
      const f = flagsFor(img);
      const box = boxFor(img);
      if (box) {
        box.toggleAttribute('data-nova-nolightbox', f.noLightbox);
        box.toggleAttribute('data-nova-noborder', f.noBorder);
      }
      if (f.flagCaption) f.flagCaption.style.display = 'none';
    });
  }
  applyFlags();
  window.addEventListener('load', applyFlags);

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
    <p class="sg-caption" aria-live="polite"></p>
  `;
  document.body.appendChild(dialog);

  const image = dialog.querySelector('.sg-image');
  const closeButton = dialog.querySelector('.sg-close');
  const previousButton = dialog.querySelector('.sg-prev');
  const nextButton = dialog.querySelector('.sg-next');
  const counter = dialog.querySelector('.sg-counter');
  const caption = dialog.querySelector('.sg-caption');
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
    // Hidden entirely when the image has no caption, so the overlay
    // doesn't reserve empty space for one.
    caption.textContent = gallery[index].caption || '';
    caption.hidden = !gallery[index].caption;
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
      alt: img.alt === 'image' ? '' : img.alt,
      caption: displayCaptionFor(img)
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
    applyFlags();
  }).observe(document.body, { childList: true, subtree: true });
})();
