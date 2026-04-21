# CLAUDE.md — agent-hubspot-cliqueur

## Vue d'ensemble du projet

Application web Next.js connectée directement à HubSpot via son API officielle.
Permet à Arnaud (et futurs utilisateurs) d'analyser les clics par thématique sur les campagnes email HubSpot, segmenter les contacts et créer des listes directement dans HubSpot.

## Stack technique

- **Framework** : Next.js 16 (App Router, TypeScript)
- **Auth** : NextAuth.js v5 (beta) avec Supabase
- **Base de données** : Supabase (PostgreSQL) — hébergé EU Frankfurt (RGPD)
- **API externe** : HubSpot Marketing Hub Professional
- **Déploiement** : Vercel (déploiement automatique depuis GitHub)
- **Style** : Tailwind CSS — design minimaliste, monochrome, zéro couleur, zéro dégradé
- **Icons** : SVG uniquement — zéro emoji, zéro émoticône

## Règles de design NON NÉGOCIABLES

- Zéro couleur décorative — noir, blanc, gris uniquement
- Zéro dégradé
- Zéro emoji ou émoticône
- Icônes SVG inline uniquement
- Interface premium, minimaliste, SaaS haute qualité
- Responsive — adapté à tous les écrans de travail (desktop, laptop)
- Chaque élément affiché doit être utile

## Structure du projet

```
src/
  app/
    api/
      auth/[...nextauth]/   # Auth NextAuth
      hubspot/              # Routes API HubSpot (jamais côté client)
    login/                  # Page de connexion
    dashboard/              # Dashboard principal
  lib/
    auth.ts                 # Config NextAuth
    hubspot.ts              # Client HubSpot
    supabase.ts             # Client Supabase
  components/
    ui/                     # Composants réutilisables
  middleware.ts             # Protection des routes
```

## Sécurité — règles absolues

- Zéro token HubSpot côté client — tout passe par les API routes Next.js
- Variables d'environnement Vercel uniquement (jamais dans le code)
- Rate limiting sur toutes les routes API
- Sessions JWT signées, expiration 8h
- CORS strict
- .env.local jamais committé sur GitHub (.gitignore couvre .env*)

## Variables d'environnement

```
HUBSPOT_ACCESS_TOKEN=           # Token app privée HubSpot
NEXT_PUBLIC_SUPABASE_URL=       # URL projet Supabase (EU Frankfurt)
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Clé publique Supabase
SUPABASE_SERVICE_ROLE_KEY=      # Clé service role (jamais côté client)
NEXTAUTH_SECRET=                # Secret JWT généré via openssl
NEXTAUTH_URL=                   # URL app (localhost:3000 en dev, vercel en prod)
```

## Convention de nommage des campagnes HubSpot

Les emails HubSpot suivent ce pattern :
```
[TYPE] - [AUDIENCE] - [OPTIONNEL: édition] - [THÉMATIQUE] (Xème envoi MMAAAA)
```

**Types :**
- `CV` = Classe Virtuelle
- `PRES` = Présentiel
- `(A)` en préfixe = A/B testing

**Audiences :**
- `MG` = Médecins Généralistes
- `CD` = Chirurgiens-Dentistes
- `MK` = Masseurs-Kinésithérapeutes
- `prospect` / `clients` = segmentation commerciale

**Éditions spéciales :**
- `RM7` = 7ème édition des Rencontres Médéré

**Exemples :**
- `(A) CV - MG - Sommeil (5ème envoi 032026)` → Classe Virtuelle, MG, thème: Sommeil
- `PRES - CD - RM7 - Chirurgie guidée (2eme envoi 032026)` → Présentiel, CD, RM7, thème: Chirurgie guidée
- `CV - MK - Pathologies de l'épaule (3eme envoi 032026)` → Classe Virtuelle, MK, thème: Pathologies de l'épaule

## Fonctionnalités MVP

1. **Auth sécurisée** — login/mot de passe via Supabase. Arnaud peut inviter des utilisateurs en lecture seule.
2. **Sync HubSpot** — récupération des campagnes email sur période choisie (7 / 28 / 90 / 360 jours). Parsing automatique du nom pour extraire type, audience, thématique.
3. **Dashboard thématiques** — clics par contact, par thématique, par audience, filtrable.
4. **Top cliqueurs** — contacts les plus engagés globalement et par thématique, avec taux d'ouverture.
5. **Création de listes HubSpot** — depuis l'app, sans jamais supprimer de listes existantes.
6. **Export CSV** — export des données selon les filtres actifs.

## Fonctionnalités post-MVP (ne pas implémenter maintenant)

- Analyse IA Claude pour scoring thématique
- Notifications automatiques
- Intégration d'autres outils

## Scopes HubSpot configurés

- `crm.lists.read`
- `crm.lists.write`
- `crm.objects.contacts.read`
- `marketing.campaigns.read`

## Workflow de développement

1. Coder avec Claude Code dans le terminal VS Code
2. Vérifier dans le navigateur sur localhost:3000
3. Commiter via GitHub Desktop
4. Vercel déploie automatiquement depuis GitHub

## Commandes utiles

```bash
npm run dev          # Lancer le serveur de développement
npm run build        # Build de production
npm run lint         # Vérifier le code
```

## Contexte métier

- **Client final** : Arnaud (marketing automation chez Médéré)
- **Médéré** : organisme de formation médicale et dentaire certifié DPC
- **Objectif** : segmenter les contacts selon leur appétence thématique pour personnaliser les campagnes email
- **L'app doit être durable** : si Arnaud quitte l'entreprise, son remplaçant doit pouvoir l'utiliser sans formation-²   VB N?