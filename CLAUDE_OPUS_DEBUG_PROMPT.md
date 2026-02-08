# PROMPT CLAUDE 4.6 OPUS THINKING — OMNIA Mobile Debug + UX Sprint

> Copie-colle ce prompt complet dans Claude Opus. Il contient tout le contexte nécessaire.

---

## CONTEXTE PROJET

Tu travailles sur **OMNIA**, une webapp monorepo pour le suivi d'opérations caritatives sur le terrain :
- `apps/web` — Next.js 16.1.6 (Turbopack), PWA, i18n FR/AR/TN, WCAG 2.2
- `apps/api` — Django 4.2 / DRF (auth, RBAC, CRUD, SSOT)
- `apps/svc` — FastAPI (STT Whisper, OCR, Routing OSRM, AI Ops Brief)

**Deux rôles** : `agent` (mobile-first, terrain) et `admin` (desktop-first, coordination).

**Architecture UI** : design tokens CSS (variables), composants DS dans `src/components/ds/`, contextes React (auth, i18n, a11y, offline).

---

## BUGS CRITIQUES À FIXER (testés sur iPhone 16 via Safari + LAN HTTP)

### BUG 1 — `Invalid LatLng object: (NaN, NaN)` (CRASH)
**Fichier** : `src/components/MapView.tsx`, ligne 64 (`FlyToSelected.useEffect`)
**Cause** : `item.lat` ou `item.lng` est `undefined`/`NaN` quand une famille est sélectionnée. Certaines familles créées via l'API retournent des coordonnées nulles ou le mapping `apiFamilyToFamily` ne garde pas les valeurs numériques.
**Stack** :
```
FlyToSelected.useEffect @ MapView.tsx:64:16
MapView @ MapView.tsx:257:7 (useEffect onClusterModeChange)
AgentHomePage @ page.tsx:252:5 (mapPanel definition)
```
**Code actuel** (`MapView.tsx:56-68`) :
```tsx
function FlyToSelected({ item }: { item: FieldItem | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (item) {
      map.flyTo([item.lat, item.lng], 14, { duration: 0.5 });
    }
  }, [item, map]);
  return null;
}
```
**Fix requis** : Guard `item.lat` et `item.lng` avec `isFinite()` avant `flyTo`. Aussi vérifier que `<Marker position={[item.lat, item.lng]}` à la ligne 282 ne reçoit jamais NaN. Filtrer les items sans coordonnées valides dans le composant `MapView` lui-même.

---

### BUG 2 — Hydration Error : `<button>` dans `<button>` (CRASH)
**Fichier** : `src/components/ds/InterviewWizard.tsx`, lignes 196-230
**Erreur** : `In HTML, <button> cannot be a descendant of <button>. This will cause a hydration error.`
**Code actuel** :
```tsx
<button key={aid.id} onClick={() => toggleAid(aid.id)} ...>  {/* parent button */}
  <span>{aid.label}</span>
  {isSelected && (
    <div onClick={(e) => e.stopPropagation()}>
      <button onClick={...}>  {/* NESTED BUTTON — ILLEGAL HTML */}
        <Minus />
      </button>
      <button onClick={...}>  {/* NESTED BUTTON — ILLEGAL HTML */}
        <Plus />
      </button>
    </div>
  )}
</button>
```
**Fix requis** : Remplacer le `<button>` parent par un `<div role="button" tabIndex={0} onKeyDown={handleEnter}` ou transformer les boutons enfants +/- en `<div role="button">`. L'approche recommandée : changer le parent en `<div>` avec les bons handlers keyboard.

---

### BUG 3 — Carte ne s'affiche pas correctement sur mobile
**Observation** : Sur iPhone 16, l'onglet "Carte" montre les tiles OpenStreetMap mais décalées en haut-gauche (petite zone visible), le reste est gris. Les markers n'apparaissent pas au bon endroit.
**Cause probable** : Le conteneur de la carte (`MapContainer`) n'a pas ses dimensions calculées correctement au moment du render initial car il est dans un `hidden` tab puis affiché. Leaflet a besoin d'un `map.invalidateSize()` quand le conteneur change de visibilité.
**Fichier** : `src/components/ds/MapListLayout.tsx` — le tab "Carte" utilise `hidden sm:block` pour cacher/montrer.
**Fix requis** : Quand le mobile passe de l'onglet "Liste" à "Carte", appeler `map.invalidateSize()` après un petit délai, OU utiliser `display: block` avec `visibility: hidden` / `height: 0` au lieu de `display: none` (class `hidden`), OU ajouter un composant `InvalidateSize` dans MapView qui écoute la visibilité.

---

### BUG 4 — Sidebar Admin absente sur mobile
**Fichier** : `src/app/app/admin/layout.tsx`, ligne 59
**Code actuel** :
```tsx
<nav className="hidden md:flex flex-col shrink-0 bg-[var(--surface-raised)] ..."
```
**Problème** : `hidden md:flex` = la sidebar disparaît totalement sur mobile. Aucune navigation alternative n'est fournie. L'admin sur téléphone ne peut accéder à aucune section.
**Fix requis** : Ajouter un **bottom navigation bar** ou un **hamburger menu** pour mobile (`md:hidden`). Doit être conforme WCAG 2.2 :
- Touch targets ≥ 48px (`--touch-target-min`)
- Focus visible
- `aria-label`, `role="navigation"`
- Compatible mode "une main" (one-hand mode : les contrôles doivent rester dans la zone inférieure de l'écran, classe CSS `a11y-one-hand` déjà dans le projet)
- Les items de la sidebar mobile doivent être les mêmes que desktop (dashboard, families, users, complaints, emergencies, planner, duplicates, ops-brief)

---

### BUG 5 — TTS : dialecte tunisien non supporté
**Fichier** : `src/components/ds/TTSButton.tsx`, ligne 37
**Code actuel** :
```tsx
utterance.lang = locale === "ar" ? "ar-SA" : "fr-FR";
```
**Problème** : Quand `locale === "tn"` (tunisien), le code tombe dans le `else` → `"fr-FR"`. Le tunisien est un dialecte arabe, donc il devrait utiliser `"ar-TN"` (arabe tunisien) si disponible, sinon fallback `"ar-SA"`.
**Fix** :
```tsx
utterance.lang = locale === "ar" ? "ar-SA" : locale === "tn" ? "ar-TN" : "fr-FR";
```

---

### BUG 6 — Microphone (STT) bloqué sur iPhone
**Fichier** : `src/components/ds/PushToTalk.tsx`
**Observation** : "Impossible d'accéder au microphone" affiché sur iPhone Safari.
**Cause** : `navigator.mediaDevices.getUserMedia()` requiert un contexte sécurisé (HTTPS) sur Safari iOS. En HTTP LAN, Safari refuse.
**Fix** : Ce n'est PAS un bug code — c'est une limitation browser. Ajouter un message explicatif dans le composant quand on détecte qu'on est en contexte non-sécurisé :
```tsx
const isSecureContext = typeof window !== "undefined" && window.isSecureContext;
// Si !isSecureContext, afficher un message "Microphone nécessite HTTPS" au lieu de "Impossible d'accéder"
```

---

## AMÉLIORATIONS UX REQUISES

### AMÉLIORATION 1 — Indicateurs raccourcis clavier (keyboard hints)
**Objectif** : Montrer des petits badges `Tab`, `Enter`, `Esc` à côté des boutons interactifs pour guider les utilisateurs de navigation clavier et les évaluateurs WCAG.
**Pattern** : Un petit `<kbd>` tag stylé discret en bas-droite du bouton. Ne s'affiche que quand le mode accessibilité est activé OU quand l'utilisateur navigue au clavier (détection `focus-visible`).
**Fichiers concernés** :
- `src/components/ds/Button.tsx` — ajouter prop optionnelle `kbdHint?: string`
- `src/app/globals.css` — style pour `<kbd>` badges
- Boutons principaux : "Nouvelle visite", "Créer famille", "Alerte urgence", navigation admin

### AMÉLIORATION 2 — Plaintes agent : flow complet
**État actuel** : L'agent peut écrire une plainte dans le wizard visite (`new-visit/page.tsx`, section collapsible "Signaler un problème"). Le texte est envoyé comme `complaint_text` dans le payload de la visite. Côté admin, les plaintes sont affichées dans `admin/page.tsx` (section `ComplaintsFullView`).
**Problème** : Le bouton "Créer plainte" dans le wizard ne semble pas fonctionner (pas de `onClick` handler réel, juste un `<Button>` sans action).
**Fix requis** : Vérifier que le `complaint_text` est bien envoyé avec la visite à l'API, et que l'API crée la plainte. Si le bouton standalone "Créer plainte" dans le wizard doit être fonctionnel indépendamment de la soumission de visite, ajouter le handler.

---

## RÈGLES STRICTES

1. **NE PAS CASSER LE CODE EXISTANT** — Chaque fix doit être minimal et ciblé.
2. **Respecter le design system** — Utiliser les CSS variables existantes (`--primary`, `--touch-target-min`, `--radius-md`, etc.), pas de valeurs hardcodées.
3. **Respecter i18n** — Tout nouveau texte doit passer par `t("key")` avec ajout dans `src/i18n/translations.ts` pour les 3 locales (fr, ar, tn).
4. **Respecter WCAG 2.2** — Touch targets ≥ 48px, focus visible, aria labels, non-color-only indicators.
5. **Respecter le mode "une main"** — Les nouveaux contrôles mobiles doivent être dans la zone inférieure de l'écran quand `a11y-one-hand` est actif.
6. **Pas de nouvelles dépendances npm** sauf si absolument nécessaire.
7. **Tester que `npx next build` passe** après chaque modification.

---

## FICHIERS CLÉS À LIRE AVANT DE COMMENCER

```
src/components/MapView.tsx          — carte Leaflet + clustering + FlyToSelected
src/components/ds/MapListLayout.tsx — layout mobile tabs List/Map
src/components/ds/InterviewWizard.tsx — wizard interview (bug button nesting)
src/components/ds/TTSButton.tsx     — Text-to-Speech browser
src/components/ds/PushToTalk.tsx    — STT microphone
src/app/app/page.tsx                — AgentHomePage (map + list + family detail)
src/app/app/admin/layout.tsx        — Admin sidebar (hidden on mobile)
src/app/app/admin/page.tsx          — Admin sections (complaints, dashboard, etc.)
src/app/app/new-visit/page.tsx      — Visit wizard (complaint section)
src/lib/api.ts                      — API client + apiFamilyToFamily mapping
src/lib/accessibility-context.tsx   — A11y provider (6 toggles)
src/i18n/translations.ts            — i18n keys FR/AR/TN
src/app/globals.css                 — CSS design tokens + a11y classes
SOT/SOT_final.md                    — Source of Truth document
```

---

## ORDRE DE PRIORITÉ

1. **BUG 1** — LatLng NaN crash (bloquant, crash la page)
2. **BUG 2** — button nesting hydration (warnings + crash potentiel)
3. **BUG 3** — Carte mobile (feature principale agent inutilisable)
4. **BUG 4** — Sidebar admin mobile (navigation admin impossible)
5. **BUG 5** — TTS tunisien (quick fix 1 ligne)
6. **BUG 6** — Message STT contexte non-sécurisé (UX polish)
7. **AMÉLIORATION 1** — Keyboard hints (a11y bonus)
8. **AMÉLIORATION 2** — Complaints flow (feature completeness)

Commence par BUG 1, fix-le, puis passe au suivant. Pour chaque fix, montre le diff exact.
