const canUsePointerGlow = window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches;

if (canUsePointerGlow) {
  window.addEventListener('pointermove', function (event) {
    document.documentElement.style.setProperty('--cursor-x', event.clientX + 'px');
    document.documentElement.style.setProperty('--cursor-y', event.clientY + 'px');
    document.body.classList.add('is-pointer-active');
  });

  window.addEventListener('pointerleave', function () {
    document.body.classList.remove('is-pointer-active');
  });
}

document.querySelectorAll('.tab-button').forEach(function (button) {
  button.addEventListener('click', function () {
    const target = button.dataset.tab;
    const shell = button.closest('.tabs-shell');

    shell.querySelectorAll('.tab-button').forEach(function (item) {
      const isActive = item === button;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-selected', String(isActive));
    });

    shell.querySelectorAll('.tab-panel').forEach(function (panel) {
      const isActive = panel.dataset.panel === target;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });
  });
});

const revenueCalculators = document.querySelectorAll('[data-calculator]');

function formatEuro(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
}

revenueCalculators.forEach(function (calculator) {
  const quotesInput = calculator.querySelector('[data-calc-quotes]');
  const valueInput = calculator.querySelector('[data-calc-value]');
  const missedInput = calculator.querySelector('[data-calc-missed]');
  const potentialOutput = calculator.querySelector('[data-calc-potential]');
  const annualOutput = calculator.querySelector('[data-calc-annual]');
  const monthsOutput = calculator.querySelector('[data-calc-months]');
  const messageOutput = calculator.querySelector('[data-calc-message]');

  function updateCalculator() {
    const quotes = Math.max(Number(quotesInput.value) || 0, 0);
    const value = Math.max(Number(valueInput.value) || 0, 0);
    const missed = Math.max(Number(missedInput.value) || 0, 0);
    const recoverable = Math.max(Math.min(Math.ceil(missed * 0.25), quotes), 1);
    const monthlyPotential = recoverable * value;
    const annualPotential = monthlyPotential * 12;
    const proMonthly = 59;
    const monthsCovered = value > 0 ? Math.max(Math.round(value / proMonthly), 1) : 0;

    potentialOutput.textContent = formatEuro(monthlyPotential);
    annualOutput.textContent = formatEuro(annualPotential);
    monthsOutput.textContent = monthsCovered + ' mois';
    messageOutput.textContent = 'Hypothèse prudente : récupérer ' + recoverable + ' devis sur vos devis sans réponse. Même 1 devis à ' + formatEuro(value || 2000) + ' peut couvrir environ ' + monthsCovered + ' mois du Pack Pro.';
  }

  [quotesInput, valueInput, missedInput].forEach(function (input) {
    input.addEventListener('input', updateCalculator);
  });

  updateCalculator();
});

const form = document.getElementById('diagnostic-form');
const success = document.getElementById('success-message');
const allowedFormHost = 'formspree.io';
const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

trackingParams.forEach(function (param) {
  const input = document.getElementById(param);
  const value = new URLSearchParams(window.location.search).get(param);
  if (input && value) input.value = value.slice(0, 120);
});

if (form) {
  form.addEventListener('submit', async function (event) {
    const action = form.getAttribute('action');
    const honeypot = form.querySelector('input[name="website"]');
    let actionUrl;

    try {
      actionUrl = new URL(action);
    } catch (error) {
      actionUrl = null;
    }

    if (honeypot && honeypot.value) {
      event.preventDefault();
      return;
    }

    if (!form.checkValidity()) return;

    if (!actionUrl || actionUrl.hostname !== allowedFormHost || action.includes('REMPLACE_PAR_TON_ID_FORMSPREE')) {
      alert("Il faut remplacer l'URL Formspree dans le code avant de mettre le site en ligne.");
      event.preventDefault();
      return;
    }

    event.preventDefault();
    success.style.display = 'none';

    try {
      const response = await fetch(action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });

      if (response.ok) {
        form.reset();
        success.style.display = 'block';
      } else {
        alert("L'envoi n'a pas fonctionné. Vous pouvez nous écrire à contact@devisrelance.fr");
      }
    } catch (error) {
      alert("Erreur de connexion. Vous pouvez nous écrire à contact@devisrelance.fr");
    }
  });
}
