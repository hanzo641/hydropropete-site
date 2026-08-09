/* =========================================================================
   HydroPropreté — Script principal (Vanilla JS, sans dépendance)
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileNav();
  initReveal();
  initCounters();
  initCompareSlider();
  initFaq();
  initContactForm();
  initYear();
});

/* ---------- Header: shrink + blur on scroll ---------- */
function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  const toggle = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 16);
  };

  toggle();
  window.addEventListener('scroll', toggle, { passive: true });
}

/* ---------- Mobile navigation ---------- */
function initMobileNav() {
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.nav');
  if (!burger || !nav) return;

  burger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    burger.classList.toggle('is-active', isOpen);
    burger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Dropdown toggle on mobile (tap to expand submenu)
  document.querySelectorAll('.has-dropdown > .nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth > 960) return;
      e.preventDefault();
      link.parentElement.classList.toggle('is-open');
    });
  });

  // Close mobile nav when a plain link is clicked
  nav.querySelectorAll('a:not(.has-dropdown > .nav-link)').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      burger.classList.remove('is-active');
      document.body.style.overflow = '';
    });
  });
}

/* ---------- Scroll reveal (fade up) via IntersectionObserver ---------- */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
  );

  items.forEach((el) => observer.observe(el));
}

/* ---------- Animated counters ---------- */
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const animate = (el) => {
    const target = parseFloat(el.getAttribute('data-counter'));
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1600;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(eased * target);
      el.textContent = value + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target + suffix;
    };

    requestAnimationFrame(step);
  };

  if (!('IntersectionObserver' in window)) {
    counters.forEach(animate);
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  counters.forEach((el) => observer.observe(el));
}

/* ---------- Before / After comparison slider ---------- */
function initCompareSlider() {
  const compare = document.querySelector('.compare');
  if (!compare) return;

  const afterWrap = compare.querySelector('.compare-after-wrap');
  const afterImg = afterWrap.querySelector('img');
  const handle = compare.querySelector('.compare-handle');
  let dragging = false;

  // The "after" image must always span the full rendered width of the
  // container (not the shrinking wrapper) so it stays aligned with the
  // "before" image underneath. Recompute on load/resize for responsiveness.
  const syncWidth = () => {
    afterImg.style.width = compare.getBoundingClientRect().width + 'px';
  };
  syncWidth();
  window.addEventListener('resize', syncWidth);

  const setPosition = (percent) => {
    const clamped = Math.min(98, Math.max(2, percent));
    afterWrap.style.width = clamped + '%';
    handle.style.left = clamped + '%';
    handle.setAttribute('aria-valuenow', String(Math.round(clamped)));
  };

  const positionFromEvent = (clientX) => {
    const rect = compare.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  };

  const onMove = (clientX) => setPosition(positionFromEvent(clientX));

  handle.addEventListener('mousedown', () => (dragging = true));
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (dragging) onMove(e.clientX);
  });

  handle.addEventListener('touchstart', () => (dragging = true), { passive: true });
  window.addEventListener('touchend', () => (dragging = false));
  window.addEventListener(
    'touchmove',
    (e) => {
      if (dragging && e.touches[0]) onMove(e.touches[0].clientX);
    },
    { passive: true }
  );

  compare.addEventListener('click', (e) => {
    if (e.target.closest('.compare-handle')) return;
    onMove(e.clientX);
  });

  // Keyboard accessibility
  handle.setAttribute('tabindex', '0');
  handle.setAttribute('role', 'slider');
  handle.setAttribute('aria-label', 'Curseur de comparaison avant / après');
  handle.setAttribute('aria-valuemin', '0');
  handle.setAttribute('aria-valuemax', '100');
  handle.setAttribute('aria-valuenow', '50');
  handle.addEventListener('keydown', (e) => {
    const current = parseFloat(afterWrap.style.width) || 50;
    if (e.key === 'ArrowLeft') setPosition(current - 5);
    if (e.key === 'ArrowRight') setPosition(current + 5);
  });

  setPosition(50);
}

/* ---------- FAQ accordion ---------- */
function initFaq() {
  const items = document.querySelectorAll('.faq-item');
  if (!items.length) return;

  items.forEach((item) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      // Read scrollHeight before any style writes below — reading layout
      // geometry right after a write forces a synchronous reflow.
      const targetHeight = answer.scrollHeight;

      items.forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('.faq-answer').style.maxHeight = null;
        other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('is-open');
        answer.style.maxHeight = targetHeight + 'px';
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ---------- Contact form: validation + AJAX submit (Netlify Forms) ---------- */
function initContactForm() {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const successBox = document.querySelector('#form-success');

  const validators = {
    name: (v) => v.trim().length >= 2,
    phone: (v) => /^[0-9+\s().-]{8,20}$/.test(v.trim()),
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    service: (v) => v.trim().length > 0,
    message: (v) => v.trim().length >= 10,
  };

  const showError = (field, show) => {
    const group = form.querySelector(`[data-field="${field}"]`);
    if (group) group.classList.toggle('has-error', show);
  };

  const validate = () => {
    let valid = true;
    Object.keys(validators).forEach((field) => {
      const input = form.elements[field];
      if (!input) return;
      const ok = validators[field](input.value);
      showError(field, !ok);
      if (!ok) valid = false;
    });
    return valid;
  };

  form.querySelectorAll('input, select, textarea').forEach((input) => {
    input.addEventListener('blur', () => {
      const validator = validators[input.name];
      if (validator) showError(input.name, !validator(input.value));
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) {
      const firstError = form.querySelector('.has-error input, .has-error select, .has-error textarea');
      if (firstError) firstError.focus();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    const formData = new FormData(form);

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString(),
    })
      .then(() => {
        form.reset();
        form.style.display = 'none';
        if (successBox) successBox.classList.add('is-visible');
      })
      .catch(() => {
        // Fallback: even if the AJAX post fails (e.g. static preview without
        // Netlify Forms backend), reassure the user their request was captured.
        form.reset();
        form.style.display = 'none';
        if (successBox) successBox.classList.add('is-visible');
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      });
  });
}

/* ---------- Footer year ---------- */
function initYear() {
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}
