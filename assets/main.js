/* Auto-M · scripts du site : menu mobile, statut d'ouverture, formulaire de devis. */
(() => {
  'use strict';

  // La classe « js » est posée par le script inline du <head> (avant le premier affichage).

  const PHONE = '026 558 98 52';

  /* ---------- Menu mobile ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('menu-principal');

  if (toggle && nav) {
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const setMenu = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };

    toggle.addEventListener('click', () => setMenu(!isOpen()));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) { setMenu(false); toggle.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (isOpen() && !e.target.closest('.site-header')) setMenu(false);
    });
    // Ferme le menu quand le focus clavier quitte l'en-tête (sinon il masquerait le contenu focalisé).
    document.querySelector('.site-header').addEventListener('focusout', (e) => {
      if (isOpen() && !e.currentTarget.contains(e.relatedTarget)) setMenu(false);
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Horaires et statut « ouvert / fermé » ----------
     Source unique : les attributs data-hours du tableau des horaires. */
  const table = document.querySelector('[data-hours]');
  const statusEl = document.querySelector('[data-status]');
  const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const formatTime = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  };

  // Heure actuelle à Fribourg, quel que soit le fuseau du visiteur.
  const nowInZurich = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Zurich', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return {
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
      minutes: Number(get('hour')) * 60 + Number(get('minute'))
    };
  };

  if (table) {
    const schedule = {};
    table.querySelectorAll('tr[data-day]').forEach((row) => {
      schedule[row.dataset.day] = row.dataset.hours
        ? row.dataset.hours.split(',').map((slot) => slot.split('-').map(toMinutes))
        : [];
    });

    const describe = ({ day, minutes }) => {
      const today = schedule[day] || [];
      const current = today.find(([open, close]) => minutes >= open && minutes < close);
      if (current) {
        return { state: 'open', text: `Ouvert · ferme à ${formatTime(current[1])}` };
      }
      const laterToday = today.find(([open]) => open > minutes);
      if (laterToday) {
        return { state: 'closed', text: `Fermé · ouvre à ${formatTime(laterToday[0])}` };
      }
      for (let i = 1; i <= 7; i += 1) {
        const d = (day + i) % 7;
        const slots = schedule[d] || [];
        if (slots.length) {
          const when = i === 1 ? 'demain' : DAY_NAMES[d];
          return { state: 'closed', text: `Fermé · ouvre ${when} à ${formatTime(slots[0][0])}` };
        }
      }
      return null;
    };

    const update = () => {
      const now = nowInZurich();

      table.querySelectorAll('tr[data-day]').forEach((row) => {
        const isToday = Number(row.dataset.day) === now.day;
        row.classList.toggle('is-today', isToday);
        const badge = row.querySelector('.hours__today');
        if (isToday && !badge) {
          row.querySelector('th').insertAdjacentHTML('beforeend', '<span class="hours__today">Aujourd\'hui</span>');
        } else if (!isToday && badge) {
          badge.remove();
        }
      });

      if (statusEl) {
        const info = describe(now);
        if (info) {
          statusEl.textContent = info.text;
          statusEl.dataset.state = info.state;
          statusEl.hidden = false;
        }
      }
    };

    update();
    setInterval(update, 60 * 1000);
  }

  /* ---------- Préselection de la prestation depuis les cartes ---------- */
  const serviceSelect = document.getElementById('f-prestation');
  document.querySelectorAll('[data-service]').forEach((link) => {
    link.addEventListener('click', () => {
      if (serviceSelect) serviceSelect.value = link.dataset.service;
    });
  });

  /* ---------- Formulaire de devis ---------- */
  const form = document.getElementById('form-devis');
  if (!form) return;

  const notice = form.querySelector('[data-form-notice]');
  const formStatus = form.querySelector('[data-form-status]');
  const submitBtn = form.querySelector('[type="submit"]');
  const loadedAt = Date.now();

  // Pas de date passée dans le sélecteur.
  const dateInput = form.elements.date_souhaitee;
  if (dateInput) {
    const d = new Date();
    dateInput.min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const setFormEnabled = (enabled) => {
    Array.from(form.elements).forEach((el) => { el.disabled = !enabled; });
    notice.hidden = enabled;
  };

  // Le formulaire n'est actif que si contact.php répond et que l'envoi est configuré.
  // Sinon (site ouvert sans PHP, e-mail non renseigné…), il est désactivé et renvoie au téléphone.
  setFormEnabled(false);
  fetch('contact.php?etat=1', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => setFormEnabled(Boolean(data && data.configured)))
    .catch(() => setFormEnabled(false));

  const messages = {
    nom: { valueMissing: 'Indiquez votre nom.' },
    telephone: {
      valueMissing: 'Indiquez un numéro de téléphone pour que nous puissions vous rappeler.',
      patternMismatch: 'Ce numéro ne semble pas valide (chiffres, espaces et + uniquement).',
      tooFewDigits: 'Ce numéro semble incomplet.'
    },
    email: { typeMismatch: 'Cette adresse e-mail ne semble pas valide.' },
    prestation: { valueMissing: 'Choisissez une prestation.' },
    message: {
      valueMissing: 'Décrivez brièvement votre demande.',
      tooShort: 'Votre message est un peu court (10 caractères minimum).'
    }
  };

  const errorFor = (field) => {
    const v = field.validity;
    const m = messages[field.name] || {};
    if (v.valueMissing) return m.valueMissing || 'Ce champ est obligatoire.';
    if (v.typeMismatch) return m.typeMismatch || 'Valeur non valide.';
    if (v.patternMismatch) return m.patternMismatch || 'Valeur non valide.';
    // tooShort n'est signalé par le navigateur qu'après une saisie au clavier : on le vérifie aussi ici.
    if (v.tooShort || (field.minLength > 0 && field.value.trim().length < field.minLength)) {
      return m.tooShort || 'Texte trop court.';
    }
    if (field.name === 'telephone' && field.value.replace(/\D/g, '').length < 9) return m.tooFewDigits;
    return '';
  };

  const showError = (field, text) => {
    const box = document.getElementById(`${field.id}-err`);
    field.setAttribute('aria-invalid', text ? 'true' : 'false');
    if (box) {
      box.textContent = text;
      box.hidden = !text;
    }
  };

  const validatedFields = Object.keys(messages).map((name) => form.elements[name]).filter(Boolean);

  validatedFields.forEach((field) => {
    const recheck = () => { if (field.getAttribute('aria-invalid') === 'true') showError(field, errorFor(field)); };
    field.addEventListener('input', recheck);
    field.addEventListener('change', recheck);
  });

  const setStatus = (state, text) => {
    formStatus.dataset.state = state;
    formStatus.textContent = text;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', '');

    let firstInvalid = null;
    validatedFields.forEach((field) => {
      const err = errorFor(field);
      showError(field, err);
      if (err && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    form.elements.t.value = String(Math.round((Date.now() - loadedAt) / 1000));
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.ok) {
        form.reset();
        setStatus('success', 'Merci, votre demande a bien été envoyée. Nous vous rappelons pendant nos heures d\'ouverture.');
      } else if (data.errors) {
        Object.entries(data.errors).forEach(([name, text]) => {
          const field = form.elements[name];
          if (field) showError(field, text);
        });
        setStatus('error', 'Certains champs sont à corriger.');
      } else {
        setStatus('error', `${data.message || 'L\'envoi n\'a pas abouti.'} Vous pouvez nous appeler au ${PHONE}.`);
      }
    } catch (err) {
      setStatus('error', `L'envoi n'a pas abouti (connexion interrompue). Réessayez ou appelez-nous au ${PHONE}.`);
    } finally {
      clearTimeout(timer);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer la demande';
    }
  });
})();
