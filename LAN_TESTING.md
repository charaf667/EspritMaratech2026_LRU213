# LAN Device Testing Guide — HTTPS + WebAuthn + Accessibilité

Tester OMNIA sur téléphone réel (iPhone Safari, Android Chrome) avec **HTTPS**, **Face ID/Passkeys** et les **6 fonctions d'accessibilité**.

## Prérequis

- PC et téléphone sur le **même réseau Wi-Fi / partage de connexion**
- IP LAN du PC : `192.168.137.149` (adapter si différente)
- mkcert installé + certificats générés (déjà fait)

---

## Étape 1 — Installer le certificat CA sur le téléphone

Le fichier CA root se trouve ici sur le PC :
```
C:\Users\charaf\AppData\Local\mkcert\rootCA.pem
```

### iPhone (iOS)
1. **Envoie** `rootCA.pem` par email, AirDrop, ou partage réseau
2. **Ouvre** le fichier sur iPhone → "Profil téléchargé"
3. **Réglages** → Général → VPN et gestion des appareils → Profil mkcert → **Installer**
4. **Réglages** → Général → Informations → **Réglages de confiance des certificats** → **Active** le toggle pour mkcert
5. Vérifie : ouvre Safari → `https://192.168.137.149:3000` → **pas d'avertissement de sécurité**

### Android
1. **Envoie** `rootCA.pem` au téléphone
2. **Paramètres** → Sécurité → Chiffrement et identifiants → **Installer un certificat** → CA cert
3. Sélectionne `rootCA.pem` → Confirme

---

## Étape 2 — Démarrer les services (PC)

Ouvre **3 terminaux** dans `c:\Users\charaf\Desktop\LRU213` :

```powershell
# Terminal 1 — Django API
cd apps/api
python manage.py runserver 0.0.0.0:8000

# Terminal 2 — Next.js HTTPS
cd apps/web
npx next dev --hostname 0.0.0.0 --port 3000 --experimental-https --experimental-https-key "..\..\localhost+3-key.pem" --experimental-https-cert "..\..\localhost+3.pem"

# Terminal 3 — FastAPI (optionnel, pour Ops Brief)
cd apps/svc
uvicorn main:app --host 0.0.0.0 --port 8001
```

---

## Étape 3 — Ouvrir sur le téléphone

```
https://192.168.137.149:3000
```

> ⚠️ Si "connexion non sécurisée" s'affiche, le certificat CA n'est pas installé (retour Étape 1).

---

## Étape 4 — Test complet

### A) Authentification

| # | Test | Attendu |
|---|------|---------|
| 1 | Ouvrir la page login | Formulaire + switcher de langue visible |
| 2 | Login `sara@omnia.org` / `dev12345` | Redirige vers `/app` (agent) |
| 3 | **Bouton Face ID / Passkey visible** | ✅ Apparaît car HTTPS = secure context |
| 4 | Login `admin@omnia.org` / `dev12345` | Redirige vers `/app/admin` |

### B) UX Agent — Uber-like Map

| # | Test | Attendu |
|---|------|---------|
| 5 | Carte visible en arrière-plan | Carte OSM avec marqueurs des familles |
| 6 | **Drag le Bottom Sheet** vers le haut | Sheet passe de peek → mid → full |
| 7 | Bouton "Liste" | Sheet snap au full (liste complète) |
| 8 | Bouton "Carte" | Sheet snap au peek (carte dominante) |
| 9 | Tap une famille dans la liste | La carte fly vers le marqueur |
| 10 | Bouton "Nouvelle visite" | Wizard de visite s'ouvre |
| 11 | Bouton urgence (FAB rouge) | Sheet d'urgence s'ouvre |

### C) UX Admin — Sidebar + Dashboard

| # | Test | Attendu |
|---|------|---------|
| 12 | Bottom nav mobile (8 sections) | Scroll horizontal, toutes les sections accessibles |
| 13 | Dashboard | KPIs, graphiques, queue critique chargent |
| 14 | Familles | Liste paginée avec filtres |
| 15 | Plaintes | Liste avec statuts filtrable |
| 16 | Urgences | Timeline des incidents |
| 17 | Ops Brief (si Ollama actif) | Génération IA fonctionne |

### D) Accessibilité (6 fonctions SOT-04)

| # | Test | Attendu |
|---|------|---------|
| 18 | Ouvrir le panneau ♿ | Panneau slide-over avec 6 toggles |
| 19 | **Lecture simplifiée** | Textes secondaires/tertiaires masqués |
| 20 | **Grande taille** | Polices et espacements augmentés |
| 21 | **Contraste élevé** | Bordures nettes, focus ring 3px, couleurs renforcées |
| 22 | **Mode une main** | Boutons d'action fixés en bas de l'écran |
| 23 | **Mode interview** | 1 question par écran, gros boutons |
| 24 | **Lecture vocale (TTS)** | Bouton "Lire" / "Stop", synthèse vocale fonctionne |

### E) i18n + RTL

| # | Test | Attendu |
|---|------|---------|
| 25 | Switcher FR | Interface en français |
| 26 | Switcher AR | Interface en arabe, layout **miroir RTL** |
| 27 | TTS en arabe | `ar-TN` (dialecte tunisien) |

### F) Offline / PWA

| # | Test | Attendu |
|---|------|---------|
| 28 | Activer mode avion | Bannière offline jaune s'affiche |
| 29 | Naviguer dans l'app | Données cached toujours visibles |
| 30 | Désactiver mode avion | Bannière disparaît, sync reprend |

---

## Troubleshooting

| Problème | Solution |
|----------|----------|
| "Connexion non sécurisée" sur phone | Installer `rootCA.pem` sur le téléphone (Étape 1) |
| CSRF Failed / 403 | Vérifier `CSRF_TRUSTED_ORIGINS` dans `.env` contient `https://192.168.137.149:3000` |
| Face ID / Passkey invisible | Vérifier HTTPS (pas HTTP). Vérifier `WEBAUTHN_RP_ID=192.168.137.149` dans `.env` |
| Network Error | Même réseau Wi-Fi ? Firewall Windows autorise ports 3000 + 8000 ? |
| Page blanche | Rebuild Next.js après changement de `.env.local` |
| Carte ne charge pas | Vérifier accès internet (tiles OSM) même en LAN |

## Remote Debugging

- **iPhone + Safari** : Câble USB → Safari desktop → menu Développement → sélectionner l'appareil
- **Android + Chrome** : Câble USB → `chrome://inspect` dans Chrome desktop
