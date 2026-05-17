# Devis Relance - Mise en ligne

## Fichiers à envoyer

Envoyer tout le contenu du dossier sur l’hébergement :

- `*.html`
- `styles.css`
- `script.js`
- `auth.js`
- `app-config.js`
- `robots.txt`
- `sitemap.xml`
- `supabase-schema.sql` uniquement comme référence, pas nécessaire dans le dossier public
- `_headers` si hébergement Netlify / Cloudflare Pages compatible
- `.htaccess` si hébergement Apache

## Configuration obligatoire avant ouverture publique

Dans `app-config.js`, remplacer :

- `REMPLACE_SUPABASE_URL`
- `REMPLACE_SUPABASE_ANON_KEY`

Ajouter les liens Stripe live :

```js
stripePaymentLinks: {
  decouverte: "LIEN_STRIPE_LIVE_DECOUVERTE",
  pro: "LIEN_STRIPE_LIVE_PRO",
  premium: "LIEN_STRIPE_LIVE_PREMIUM"
}
```

Ne jamais mettre dans le site :

- clé Supabase `service_role`
- secret Stripe
- webhook secret Stripe
- mot de passe client
- export client CSV

## Supabase

1. Créer un projet Supabase.
2. Exécuter `supabase-schema.sql` dans le SQL editor.
3. Activer l’authentification par email magic link.
4. Ajouter l’URL de redirection autorisée :

```txt
https://devisrelance.fr/dashboard.html
```

5. Vérifier que Row Level Security est actif sur `profiles` et `quotes`.

## Stripe

Créer trois Payment Links live :

- Découverte : `14,90 € HT/mois`
- Pro Humain : `24,90 € HT/mois`
- Premium : `39,90 € HT/mois`

Le webhook Stripe doit mettre à jour `profiles.plan` et `profiles.subscription_status` côté serveur ou Edge Function uniquement.

## Admin

`admin.html` est bloqué des moteurs et l’accès statique est désactivé par défaut :

```js
adminPreviewEnabled: false
```

Pour une vraie production, utiliser un compte Supabase avec rôle admin côté base. Ne pas activer l’admin statique pour gérer de vraies données clients.

## Vérifications après mise en ligne

- Ouvrir `https://devisrelance.fr/`
- Tester le formulaire diagnostic.
- Tester la création de compte.
- Vérifier l’email magic link.
- Vérifier l’accès dashboard.
- Vérifier que `/dashboard.html` redirige ou bloque sans session.
- Soumettre `https://devisrelance.fr/sitemap.xml` dans Google Search Console.
