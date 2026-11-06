# Referee Tracker — site vitrine & inscription

Site statique (HTML/CSS/JS vanilla, aucun framework, aucun CDN hors Google Fonts) servi par GitHub Pages sur **https://www.referee-tracker.fr**, et deux fonctions Supabase Edge pour l'inscription et la première connexion.

```
index.html          vitrine
inscription.html    formulaire 4 étapes (POST → fonction « inscription » + upload des PDF)
style.css / script.js
404.html, robots.txt, sitemap.xml, CNAME
img/                logo-wordmark.png, logo-icon.png, favicon-32.png
supabase/
  migrations/20_inscriptions.sql
  functions/inscription/index.ts
  functions/premiere-connexion/index.ts
```

Aucun secret dans ce dépôt. La clé `sb_publishable_…` dans `script.js` est la clé **publique** Supabase (équivalent anon) : elle ne donne accès à rien sans RLS/fonction.

---

## 1. Mise en ligne (GitHub Pages)

```zsh
cd /chemin/vers/site-vitrine
git init -b main
git add .
git commit -m "Site vitrine Referee Tracker"
gh repo create referee-tracker-site --public --source=. --push
```

Puis sur GitHub : **Settings → Pages** → Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
Dans **Custom domain**, saisir `www.referee-tracker.fr` (le fichier `CNAME` le fixe déjà) et cocher **Enforce HTTPS** une fois le certificat émis (quelques minutes après le DNS).

### DNS Cloudflare (zone referee-tracker.fr)

| Type  | Nom   | Cible                     | Proxy |
|-------|-------|---------------------------|-------|
| CNAME | `www` | `mysteriousreb1.github.io` | **Désactivé** (nuage gris, « DNS only ») |

Le proxy doit rester désactivé pour que GitHub émette son certificat Let's Encrypt.

Redirection de l'apex `referee-tracker.fr` → `www` : **Rules → Redirect Rules → Create rule**
- Nom : `apex vers www`
- Quand : *Hostname* `equals` `referee-tracker.fr`
- Alors : *Dynamic* → expression `concat("https://www.referee-tracker.fr", http.request.uri.path)`, code **301**, « Preserve query string » coché.

Pour que la règle s'exécute, l'apex doit passer par Cloudflare : ajouter un enregistrement `A referee-tracker.fr → 192.0.2.1` (ou `AAAA 100::`) **avec proxy activé** (adresse factice, seule la règle de redirection répond).

HTTPS forcé : **SSL/TLS → Edge Certificates → Always Use HTTPS** = On, mode SSL « Full ».

---

## 2. Déployer Supabase

Prérequis : macOS + Homebrew.

```zsh
brew install supabase/tap/supabase
supabase login
cd /chemin/vers/site-vitrine
supabase link --project-ref jlstedchnmdteazuqbly
```

### 2.1 SQL

Coller le contenu de `supabase/migrations/20_inscriptions.sql` dans **Dashboard → SQL Editor → Run**. Le script est relançable.

### 2.2 Secrets (jamais dans un fichier du dépôt)

```zsh
supabase secrets set \
  CF_API_TOKEN='…' \
  CF_ZONE_ID='…' \
  SMTP_USER='referee.tracker@gmail.com' \
  SMTP_PASS='…' \
  ADMIN_SECRET="$(openssl rand -hex 32)"
```

| Secret | Où l'obtenir |
|--------|--------------|
| `CF_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token, permission **Zone / Email Routing Rules / Edit** limitée à la zone `referee-tracker.fr`. |
| `CF_ZONE_ID` | Cloudflare → Overview de la zone, colonne de droite « Zone ID ». |
| `SMTP_USER` | Le compte Gmail d'envoi (`referee.tracker@gmail.com`). |
| `SMTP_PASS` | Gmail → Sécurité → Validation en deux étapes → **Mots de passe des applications** (16 caractères). |
| `ADMIN_SECRET` | Généré ci-dessus ; à conserver dans le trousseau pour le script de provisionnement. |

Expéditeur `no-reply@referee-tracker.fr` : dans Gmail → Paramètres → Comptes → « Envoyer des e-mails en tant que » → ajouter `no-reply@referee-tracker.fr` (via SMTP Gmail, alias vérifié par une route Cloudflare `no-reply@` → `referee.tracker@gmail.com`). Sans cet alias, Gmail remplace l'expéditeur par l'adresse Gmail : l'e-mail part quand même.

### 2.3 Fonctions

```zsh
supabase functions deploy inscription --no-verify-jwt
supabase functions deploy premiere-connexion --no-verify-jwt
```

`--no-verify-jwt` : le visiteur n'est pas connecté lors de l'inscription ; la fonction vérifie elle-même les entrées, limite les origines (CORS) et refuse les doublons < 24 h.

### 2.4 Test rapide

```zsh
curl -s -X POST https://jlstedchnmdteazuqbly.supabase.co/functions/v1/inscription \
  -H 'apikey: sb_publishable_B1w244FrkzbIn-SZ-T_z8w_4HVg9stb' -H 'Content-Type: application/json' \
  -H 'Origin: https://www.referee-tracker.fr' \
  -d '{"prenom":"Test","nom_ffbb":"TEST ARBITRE","email_connexion":"toi+test@exemple.fr","email_ffbb":"toi+test@exemple.fr","fournisseur_mail":"gmail","niveau":"departemental","zones":{"cd":"CD67","ligue":"LRGEB","cf":false},"consentements":{"cgu":true,"donnees":true},"fichiers":[]}'
```

Réponse attendue : `{"ok":true,"inscription_id":"…","uploads":[]}` et un e-mail « nous configurons ton compte ».

---

## 3. Cycle de vie d'une inscription

1. **Site** → `POST /functions/v1/inscription` : crée `auth.users` + `profils` (statut `inscrit`, `adresse_reception` = `prenom@referee-tracker.fr`), `inscriptions` (payload), route Cloudflare Email Routing, e-mail de confirmation, URL d'upload signées pour les PDF (bucket privé `import/<user_id>/…`).
2. **Site** → upload des PDF puis `{ action: "fichiers_ok", inscription_id }`.
3. **Toi** (script de provisionnement) : créer le moteur Apps Script de l'arbitre, renseigner `profils.api_url`, puis demander l'envoi du code :
   ```zsh
   curl -s -X POST https://jlstedchnmdteazuqbly.supabase.co/functions/v1/inscription \
     -H "X-Admin-Secret: $ADMIN_SECRET" -H 'Content-Type: application/json' \
     -d '{"action":"envoyer_code","email":"arbitre@exemple.fr"}'
   ```
   → statut `moteur_pret`, e-mail « Ton compte Referee Tracker est prêt » avec le code `XXXX-XXXX` (14 jours) et le mode d'emploi du transfert selon le fournisseur.
4. **App** → `POST /functions/v1/premiere-connexion` `{ email, code }` → `{ ok, token_hash }` → `supabase.auth.verifyOtp({ type: "recovery", token_hash })` puis `updateUser({ password })`. Statut `actif`.

Si `inscriptions.erreur = "route_cloudflare_manuelle"`, créer la route à la main : Cloudflare → Email → Routing → Routes → Custom address `prenom@referee-tracker.fr` → forward `referee.tracker@gmail.com`.

---

## 4. Contrôles locaux

```zsh
python3 -m http.server 8080            # http://localhost:8080 (CORS localhost autorisé par la fonction)
deno check supabase/functions/*/index.ts
```
