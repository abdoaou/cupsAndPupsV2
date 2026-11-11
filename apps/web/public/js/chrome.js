function loadPromoScripts() {
  if (window.__promoScriptsQueued) return;
  window.__promoScriptsQueued = true;

  const add = (src, onload) => {
    if ([...document.scripts].some((s) => s.getAttribute('src') === src)) {
      onload();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.onload = onload;
    document.body.appendChild(el);
  };

  const start = () => {
    if (window.mountPromo) window.mountPromo();
  };

  if (window.PROMO_CONFIG) {
    add('/js/promo.js', start);
  } else {
    add('/js/promo-config.js', () => add('/js/promo.js', start));
  }
}

function mountChrome({ home = false } = {}) {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');

  if (header) {
    header.className = home ? 'site-header' : 'site-header solid';
    header.innerHTML = `
      <div class="header-inner">
        <a class="brand" href="/">Cups &amp; Pups</a>
        <nav class="nav" aria-label="Primary">
          <a href="/#prices">Book Grooming</a>
          <a href="/menu">Café Menu</a>
          <a href="/shop">Shop</a>
          <a href="/account">Account</a>
        </nav>
        <a class="btn btn-sage btn-sm" href="/#prices">Book now</a>
      </div>
    `;
  }

  if (footer) {
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="footer-inner">
        <div>
          <div class="brand">Cups &amp; Pups</div>
          <p>One neighborhood spot for grooming, coffee, and everything your pet needs.</p>
        </div>
        <div class="footer-links">
          <a href="/#prices">Book grooming</a>
          <a href="/menu">Menu</a>
          <a href="/shop">Shop</a>
          <a href="/account">Account</a>
        </div>
      </div>
    `;
  }

  loadPromoScripts();
}

window.mountChrome = mountChrome;
