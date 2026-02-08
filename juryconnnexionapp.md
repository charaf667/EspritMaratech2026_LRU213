# Connexion App — Guide Jury (LAN Real-Device Testing)

## Prérequis
- PC et téléphone (iPhone/Android) connectés au **même réseau Wi-Fi**
- Django + Next.js lancés sur le PC

---

## Étape 1 — Trouver l'IP Wi-Fi du PC

```powershell
# Automatique (script fourni)
.\scripts\lan-setup.ps1

# Manuel
powershell -c "(Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4).IPAddress"
```

> Ignorer les IPs `169.254.x.x` (autoconfiguration) et `192.168.190/192.x` (VMware).

---

## Étape 2 — Mettre à jour les fichiers `.env`

### `.env` (racine du projet)
```env
ALLOWED_HOSTS=localhost,127.0.0.1,<IP>
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://<IP>:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://<IP>:3000
WEBAUTHN_ORIGIN=http://localhost:3000,http://<IP>:3000
```

### `apps/web/.env.local`
```env
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_API_BASE_URL=http://<IP>:8000
```

> Remplacer `<IP>` par l'IP Wi-Fi détectée (ex: `192.168.137.149`).

---

## Étape 3 — Pare-feu Windows (une seule fois)

Ouvrir **PowerShell en Administrateur** :
```powershell
netsh advfirewall firewall add rule name="OMNIA Dev 3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="OMNIA Dev 8000" dir=in action=allow protocol=TCP localport=8000
```

---

## Étape 4 — Lancer les serveurs

```powershell
# Terminal 1 — Django API (bind toutes interfaces)
cd apps/api
python manage.py runserver 0.0.0.0:8000

# Terminal 2 — FastAPI service (optionnel, pour STT/routing/IA)
cd apps/svc
.venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8001

# Terminal 3 — Next.js frontend (IMPORTANT: --hostname 0.0.0.0)
cd apps/web
npx next dev --hostname 0.0.0.0 --port 3000
```

> **Sans `--hostname 0.0.0.0`**, Next.js écoute uniquement sur localhost et refuse les connexions LAN.

---

## Étape 5 — Ouvrir sur le téléphone

Sur Safari (iPhone) ou Chrome (Android) :
```
http://<IP>:3000
```

---

## Changement de Wi-Fi (devant le jury)

Un seul script à exécuter :
```powershell
.\scripts\lan-setup.ps1
```
Il détecte la nouvelle IP, met à jour `.env` et `apps/web/.env.local`, puis affiche l'URL à taper.
Ensuite relancer les serveurs.

---

## Comptes de test

| Rôle  | Email              | Mot de passe |
|-------|--------------------|--------------|
| Admin | admin@omnia.org    | dev12345     |
| Agent | sara@omnia.org     | dev12345     |

---

## Limitations connues en HTTP LAN

| Fonctionnalité | Statut | Pourquoi |
|----------------|--------|----------|
| Login email/password | ✅ Marche | — |
| Navigation complète | ✅ Marche | — |
| Carte Leaflet | ✅ Marche | Tiles OSM chargées via HTTPS |
| PWA Install | ⚠️ Limité | Le prompt "Add to Home" nécessite HTTPS sur certains browsers |
| **Face ID / Passkeys (WebAuthn)** | ❌ Ne marche pas | WebAuthn exige un contexte sécurisé (HTTPS ou localhost). Sur HTTP LAN, le browser refuse l'enregistrement/authentification biométrique. **Solution production** : déployer derrière un reverse proxy HTTPS (ex: Caddy, nginx + Let's Encrypt). **Solution démo** : utiliser email/password. |
| **Microphone (STT)** | ⚠️ iPhone bloque | `getUserMedia` requiert HTTPS sur Safari iOS. Chrome Android est plus permissif sur LAN HTTP. |
| TTS (lecture vocale) | ✅ Marche | Utilise `SpeechSynthesis` (API navigateur, pas de réseau) |

---

## Debug remote

| Device | Méthode |
|--------|---------|
| iPhone + Mac | USB → Safari Desktop → menu Développement → sélectionner device |
| iPhone sans Mac | Pas de debug console, mais l'app fonctionne normalement |
| Android réel | USB → Chrome Desktop → `chrome://inspect` |
| Android Studio (émulateur) | URL: `http://10.0.2.2:3000` (alias localhost hôte) |
| PC uniquement | Chrome DevTools `F12` → `Ctrl+Shift+M` (Device Toolbar) |

---

## Checklist de validation

| # | Test | Attendu |
|---|------|---------|
| 1 | Page login s'affiche | Formulaire + switch langue |
| 2 | Login agent `sara@omnia.org` | Redirige vers `/app` |
| 3 | Liste familles | Cards avec priorité, adresse, badges |
| 4 | Toggle Carte/Liste | Switch entre les deux vues |
| 5 | Tap famille → détail | Bottom sheet avec infos + actions |
| 6 | Créer famille (+) | Sheet création avec GPS |
| 7 | Nouvelle visite | Wizard 3 étapes |
| 8 | Login admin `admin@omnia.org` | Redirige vers `/app/admin` |
| 9 | Sidebar admin | Dashboard, Familles, Users, Plaintes, Urgences, Planner, Doublons, IA |
| 10 | Mission Planner | Filtres + compute route |
| 11 | Duplicates | Queue compare + merge |
| 12 | Accessibilité | 6 toggles fonctionnels |
| 13 | i18n FR/AR/TN | Switch langue + RTL |
| 14 | Mode offline | Banner offline + données cache |

---

## Troubleshooting

| Problème | Solution |
|----------|----------|
| "Safari ne peut pas ouvrir la page" | Vérifier même Wi-Fi + pare-feu Windows ouvert ports 3000/8000 |
| CSRF Failed | Ajouter IP dans `CORS_ALLOWED_ORIGINS` + relancer Django |
| Page blanche | Vérifier `NEXT_PUBLIC_API_BASE_URL` utilise IP LAN, pas localhost |
| Carte vide / erreur NaN | Bug connu — familles sans coordonnées GPS valides |
| 403 Forbidden après logout | Normal — session expirée, re-login |
| Port déjà utilisé | `netstat -ano | findstr :3000` puis `taskkill /PID <pid> /F` |
