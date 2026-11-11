(function () {
  const DISMISS_KEY = 'cupsPromoAnnounceDismissed';
  const FLYER_KEY = 'cupsPromoFlyerDismissed';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function whatsappDigits(number) {
    return String(number || '').replace(/\D/g, '');
  }

  function waLink(number, text) {
    const digits = whatsappDigits(number);
    const encoded = encodeURIComponent(text || '');
    return `https://wa.me/${digits}?text=${encoded}`;
  }

  function bookingMessage(pkg, cfg) {
    if (!pkg) return cfg.genericBookingMessage;
    const species = pkg.species === 'cat' ? 'cat' : 'dog';
    return `Hi Cups & Pups! I'd like to book: ${pkg.name} for my ${species}.`;
  }

  function setAnnounceOffset(bar) {
    const height = bar && document.body.contains(bar) ? bar.offsetHeight : 0;
    document.documentElement.style.setProperty('--promo-announce-h', `${height}px`);
  }

  function mountAnnouncement(cfg) {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;

    const header = document.getElementById('site-header');
    if (!header) return;

    let bar = document.getElementById('promo-announce');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'promo-announce';
      header.insertAdjacentElement('beforebegin', bar);
    }

    bar.className = 'promo-announce';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Promotion');
    bar.innerHTML = `
      <p class="promo-announce-text">${escapeHtml(cfg.announcement)}</p>
      <button type="button" class="promo-announce-dismiss" aria-label="Dismiss announcement">
        <span aria-hidden="true">&times;</span>
      </button>
    `;

    document.body.classList.add('has-promo-announce');
    setAnnounceOffset(bar);

    if (!window.__promoDismissBound) {
      window.__promoDismissBound = true;
      document.addEventListener('click', (event) => {
        if (!event.target.closest('.promo-announce-dismiss')) return;
        sessionStorage.setItem(DISMISS_KEY, '1');
        const live = document.getElementById('promo-announce');
        if (live) live.remove();
        document.body.classList.remove('has-promo-announce');
        setAnnounceOffset(null);
      });
    }

    if (!window.__promoResizeBound) {
      window.__promoResizeBound = true;
      window.addEventListener('resize', () =>
        setAnnounceOffset(document.getElementById('promo-announce')),
      );
    }
  }

  function renderCountdown(cfg) {
    if (!cfg.offerEndsAt) return '';
    const end = new Date(cfg.offerEndsAt);
    if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) return '';
    return `<p class="promo-countdown" data-promo-countdown="${escapeHtml(cfg.offerEndsAt)}" aria-live="polite"></p>`;
  }

  function tickCountdown() {
    document.querySelectorAll('[data-promo-countdown]').forEach((el) => {
      const end = new Date(el.getAttribute('data-promo-countdown'));
      const diff = end.getTime() - Date.now();
      if (diff <= 0) {
        el.textContent = 'This offer has ended.';
        return;
      }
      const total = Math.floor(diff / 1000);
      const days = Math.floor(total / 86400);
      const hours = Math.floor((total % 86400) / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      el.textContent =
        days > 0
          ? `Offer ends in ${days}d ${hours}h ${minutes}m`
          : `Offer ends in ${hours}h ${minutes}m`;
    });
  }

  function packageCard(pkg, cfg) {
    const coffee = pkg.includesFreeCoffee
      ? `<span class="promo-coffee-ribbon">${escapeHtml(cfg.freeCoffeeBadge)}</span>`
      : '';
    const best = pkg.bestValue
      ? `<span class="groom-badge promo-best">${escapeHtml(pkg.badge || 'Best Value')}</span>`
      : '';
    const mark = pkg.species === 'cat' ? '<span class="whisker-mark" aria-hidden="true"></span>' : '<span class="paw-mark" aria-hidden="true"></span>';
    const href = waLink(cfg.WHATSAPP_NUMBER, bookingMessage(pkg, cfg));
    const tilt = pkg.bestValue ? 'tilt-right' : pkg.species === 'cat' ? 'tilt-left' : '';
    const extraClass = pkg.species === 'cat' ? 'cat-card' : pkg.bestValue ? 'promo-card-hot' : '';

    return `<article class="groom-card ${tilt} ${extraClass}">
      ${best}
      ${coffee}
      <h3>${mark} ${escapeHtml(pkg.name)}</h3>
      <p class="groom-blurb">${escapeHtml(pkg.blurb || '')}</p>
      <p class="price-value">${escapeHtml(pkg.price)}</p>
      <a class="btn btn-sage promo-book" href="${href}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(cfg.bookNowLabel)}
      </a>
    </article>`;
  }

  function mountHome(cfg) {
    const headline = document.getElementById('promo-headline');
    const sub = document.getElementById('promo-subheadline');
    if (headline) headline.textContent = cfg.headline;
    if (sub) sub.textContent = cfg.subheadline;

    const waCta = document.getElementById('promo-wa-cta');
    if (waCta) {
      waCta.href = waLink(cfg.WHATSAPP_NUMBER, cfg.genericBookingMessage);
      waCta.textContent = cfg.ctaWhatsApp;
    }

    const pricesCta = document.getElementById('promo-prices-cta');
    if (pricesCta) pricesCta.textContent = cfg.ctaPrices;

    const packagesRoot = document.getElementById('pamper-packages-root');
    if (packagesRoot) {
      const groups = cfg.groups || [];
      packagesRoot.innerHTML = groups
        .map((group) => {
          const cards = (cfg.packages || [])
            .filter((pkg) => pkg.group === group.id)
            .map((pkg) => packageCard(pkg, cfg))
            .join('');
          return `<div class="promo-group">
            <h3 class="promo-group-title">${escapeHtml(group.label)}</h3>
            <div class="groom-board promo-board">${cards}</div>
          </div>`;
        })
        .join('');
    }

    const note = document.getElementById('promo-coffee-note');
    if (note) note.textContent = cfg.freeCoffeeNote;

    const drinksTitle = document.getElementById('promo-drinks-title');
    const drinksNote = document.getElementById('promo-drinks-note');
    const drinksCta = document.getElementById('promo-drinks-cta');
    if (drinksTitle) drinksTitle.textContent = cfg.drinksBannerTitle;
    if (drinksNote) drinksNote.textContent = cfg.drinksBannerNote;
    if (drinksCta) {
      drinksCta.href = cfg.drinksHref || '/menu';
      drinksCta.textContent = cfg.drinksCta;
    }

    const loyalty = document.getElementById('promo-loyalty');
    if (loyalty) {
      if (cfg.loyalty && cfg.loyalty.enabled) {
        loyalty.hidden = false;
        loyalty.textContent = cfg.loyalty.text;
      } else {
        loyalty.hidden = true;
      }
    }

    const share = document.getElementById('promo-share');
    if (share) {
      const url = cfg.shareUrl || window.location.origin + '/';
      const text = `${cfg.shareMessage} ${url}`;
      share.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
      share.textContent = cfg.shareLabel;
    }

    const countdownHost = document.getElementById('promo-countdown-host');
    if (countdownHost) {
      countdownHost.innerHTML = renderCountdown(cfg);
      tickCountdown();
    }

    injectJsonLd(cfg);
  }

  function closeFlyer() {
    sessionStorage.setItem(FLYER_KEY, '1');
    document.body.classList.remove('has-promo-flyer');
    document.querySelectorAll('#promo-flyer, .promo-flyer').forEach((dialog) => {
      dialog.classList.remove('is-open');
      window.setTimeout(() => dialog.remove(), 220);
    });
  }

  window.closeCupsFlyer = closeFlyer;

  function mountFlyer(cfg) {
    const flyer = cfg.flyer;
    if (!flyer || flyer.enabled === false) return;
    if (sessionStorage.getItem(FLYER_KEY) === '1') return;
    if (document.getElementById('promo-flyer')) return;

    const pricesHref = '/#prices';
    const menuHref = cfg.drinksHref || '/menu';
    const drinksPrice = escapeHtml(cfg.drinksPrice || '300,000 L.L.');

    const root = document.createElement('div');
    root.id = 'promo-flyer';
    root.className = 'promo-flyer';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'promo-flyer-title');
    root.innerHTML = `
      <div class="promo-flyer-backdrop" data-flyer-close="1"></div>
      <div class="promo-flyer-sheet">
        <button type="button" class="promo-flyer-x" data-flyer-close="1" aria-label="Close offer flyer">
          <span aria-hidden="true">&times;</span>
        </button>
        <p class="promo-flyer-kicker">${escapeHtml(flyer.kicker)}</p>
        <h2 id="promo-flyer-title">${escapeHtml(flyer.title)}</h2>
        <p class="promo-flyer-intro">${escapeHtml(flyer.intro)}</p>
        <div class="promo-flyer-offers">
          <article class="promo-flyer-card is-drinks">
            <p class="promo-flyer-tag">Café</p>
            <h3>${escapeHtml(flyer.drinksTitle)}</h3>
            <p class="promo-flyer-price">${drinksPrice}</p>
            <p>${escapeHtml(flyer.drinksText)}</p>
          </article>
          <article class="promo-flyer-card is-groom">
            <p class="promo-flyer-tag">Grooming</p>
            <h3>${escapeHtml(flyer.groomingTitle)}</h3>
            <p class="promo-flyer-price">Free coffee</p>
            <p>${escapeHtml(flyer.groomingText)}</p>
          </article>
        </div>
        <div class="promo-flyer-actions">
          <a class="btn btn-sage" href="${pricesHref}">${escapeHtml(flyer.groomingCta)}</a>
          <a class="btn btn-outline" href="${menuHref}">${escapeHtml(flyer.drinksCta)}</a>
          <button type="button" class="promo-flyer-later" data-flyer-close="1">${escapeHtml(flyer.closeLabel)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    document.body.classList.add('has-promo-flyer');

    window.setTimeout(() => {
      root.classList.add('is-open');
      const closeBtn = root.querySelector('.promo-flyer-x');
      if (closeBtn) closeBtn.focus();
    }, 280);

    if (!window.__promoFlyerClicksBound) {
      window.__promoFlyerClicksBound = true;
      document.addEventListener('click', (event) => {
        if (event.target.closest('[data-flyer-close]')) {
          event.preventDefault();
          closeFlyer();
          return;
        }
        if (event.target.closest('#promo-flyer .promo-flyer-actions a')) {
          closeFlyer();
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById('promo-flyer')) {
          closeFlyer();
        }
      });
    }
  }

  function injectJsonLd(cfg) {
    if (document.getElementById('promo-jsonld')) return;
    const offers = (cfg.packages || []).map((pkg) => ({
      '@type': 'Offer',
      name: pkg.name,
      price: String(pkg.price).replace(/[^0-9.]/g, ''),
      priceCurrency: 'USD',
      description: pkg.includesFreeCoffee
        ? `${pkg.blurb || ''} ${cfg.freeCoffeeNote}`.trim()
        : pkg.blurb || pkg.name,
    }));

    const data = {
      '@context': 'https://schema.org',
      '@type': ['LocalBusiness', 'PetStore', 'CafeOrCoffeeShop'],
      name: 'Cups & Pups',
      url: cfg.shareUrl || 'https://cupsandpups.store/',
      description:
        'Pet grooming and café in Lebanon. Sip while they shine — free coffee with grooming packages. Every drink 300,000 L.L.',
      areaServed: { '@type': 'Country', name: 'Lebanon' },
      openingHours: 'Mo-Su 08:00-19:00',
      priceRange: '$10–$20',
      makesOffer: offers,
    };

    const script = document.createElement('script');
    script.id = 'promo-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  function mountPromo() {
    const cfg = window.PROMO_CONFIG;
    if (!cfg) return;
    mountAnnouncement(cfg);
    mountHome(cfg);
    mountFlyer(cfg);
    if (!window.__promoCountdownTimer) {
      window.__promoCountdownTimer = setInterval(tickCountdown, 30000);
    }
  }

  window.mountPromo = mountPromo;
})();
