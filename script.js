const STRIPE_PAYMENT_LINKS = {
  // Remplacer uniquement ces trois liens par les liens Stripe live des abonnements mensuels.
  decouverte: "https://buy.stripe.com/test_8x228q7kPgKyf85ayD6g801",
  pro: "https://buy.stripe.com/test_fZubJ0fRl1PEe41dKP6g802",
  premium: "https://buy.stripe.com/test_7sYcN448Dbqegc9eOT6g803"
};

function formatEuro(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

document.querySelectorAll("[data-calculator]").forEach(function (calculator) {
  const quotesInput = calculator.querySelector("[data-calc-quotes]");
  const valueInput = calculator.querySelector("[data-calc-value]");
  const missedInput = calculator.querySelector("[data-calc-missed]");
  const potentialOutput = calculator.querySelector("[data-calc-potential]");
  const annualOutput = calculator.querySelector("[data-calc-annual]");
  const monthsOutput = calculator.querySelector("[data-calc-months]");
  const messageOutput = calculator.querySelector("[data-calc-message]");

  function updateCalculator() {
    const quotes = Math.max(Number(quotesInput.value) || 0, 0);
    const value = Math.max(Number(valueInput.value) || 0, 0);
    const missed = Math.max(Number(missedInput.value) || 0, 0);
    const recoverable = Math.max(Math.min(Math.ceil(missed * 0.25), quotes), 1);
    const monthlyPotential = recoverable * value;
    const annualPotential = monthlyPotential * 12;
    const monthsCovered = value > 0 ? Math.max(Math.round(value / 24.9), 1) : 0;

    potentialOutput.textContent = formatEuro(monthlyPotential);
    annualOutput.textContent = formatEuro(annualPotential);
    monthsOutput.textContent = monthsCovered + " mois";
    messageOutput.textContent = "Hypothèse prudente : récupérer " + recoverable + " devis sur vos devis sans réponse. Même 1 devis à " + formatEuro(value || 2000) + " peut couvrir environ " + monthsCovered + " mois de Pro Humain.";
  }

  [quotesInput, valueInput, missedInput].forEach(function (input) {
    input.addEventListener("input", updateCalculator);
  });
  updateCalculator();
});

document.querySelectorAll("[data-stripe-plan]").forEach(function (link) {
  const plan = link.dataset.stripePlan;
  const stripeUrl = STRIPE_PAYMENT_LINKS[plan] || link.dataset.stripeUrl || "";

  if (stripeUrl) {
    link.href = stripeUrl;
    return;
  }

  link.href = "compte.html?plan=" + encodeURIComponent(plan);
});

const currentParams = new URLSearchParams(window.location.search);
const requestedPlan = currentParams.get("plan") || currentParams.get("pack");
if (requestedPlan) {
  document.querySelectorAll("[data-plan-select]").forEach(function (select) {
    const option = Array.from(select.options).find(function (item) {
      return item.value === requestedPlan || item.textContent.toLowerCase().includes(requestedPlan);
    });
    if (option) select.value = option.value || option.textContent;
  });
}

const form = document.getElementById("diagnostic-form");
const success = document.getElementById("success-message");

if (form) {
  const params = new URLSearchParams(window.location.search);
  const pack = params.get("pack");
  const packSelect = document.getElementById("pack");

  if (pack && packSelect) {
    const option = Array.from(packSelect.options).find(function (item) {
      return item.value === pack || item.textContent.toLowerCase().includes(pack);
    });
    if (option) packSelect.value = option.value || option.textContent;
  }

  form.addEventListener("submit", async function (event) {
    const honeypot = form.querySelector('input[name="website"]');
    if (honeypot && honeypot.value) {
      event.preventDefault();
      return;
    }
    if (!form.checkValidity()) return;

    event.preventDefault();
    success.style.display = "none";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      });
      if (response.ok) {
        form.reset();
        success.style.display = "block";
      } else {
        alert("L'envoi n'a pas fonctionné. Vous pouvez nous écrire à contact@devisrelance.fr");
      }
    } catch (error) {
      alert("Erreur de connexion. Vous pouvez nous écrire à contact@devisrelance.fr");
    }
  });
}

document.querySelectorAll("[data-ajax-form]").forEach(function (ajaxForm) {
  const message = ajaxForm.querySelector("[data-success-message]");

  ajaxForm.addEventListener("submit", async function (event) {
    const honeypot = ajaxForm.querySelector('input[name="website"]');
    if (honeypot && honeypot.value) {
      event.preventDefault();
      return;
    }
    if (!ajaxForm.checkValidity()) return;

    event.preventDefault();
    if (message) message.style.display = "none";

    try {
      const response = await fetch(ajaxForm.action, {
        method: "POST",
        body: new FormData(ajaxForm),
        headers: { Accept: "application/json" }
      });
      if (response.ok) {
        ajaxForm.reset();
        if (message) message.style.display = "block";
      } else {
        alert("L'envoi n'a pas fonctionné. Vous pouvez nous écrire à contact@devisrelance.fr");
      }
    } catch (error) {
      alert("Erreur de connexion. Vous pouvez nous écrire à contact@devisrelance.fr");
    }
  });
});
