# Saooti Radio SDK

Intégrer `@saooti/radio-sdk` dans un client Electron existant. JavaScript, interface et module Rust précompilés ; aucune compilation du SDK à l'installation. Outils Node.js 24+, processus main Electron avec Node.js 24+, modules ESM.

## Installation

Copier l'URL du fichier `.tgz` correspondant à l'OS et à l'architecture d'Electron (`darwin-arm64` ou `win32-x64`, selon les fichiers disponibles) depuis les [publications](https://github.com/saooti/radio-sdk-releases/releases), puis remplacer `URL_DU_TGZ` :

```sh
npm install --allow-remote=all "URL_DU_TGZ"
```

Avec npm 12, ajouter `allow-remote=root` au `.npmrc` du projet pour les prochains `npm ci`. Enregistrer le fichier de verrouillage.

## Exemple Electron

Le dossier [sample/](https://github.com/saooti/radio-sdk-releases/tree/main/sample) du dépôt de publications contient un client complet, lié à l'archive SDK de cette version :

```sh
git clone https://github.com/saooti/radio-sdk-releases.git
cd radio-sdk-releases/sample
npm ci --allow-remote=all
cp .env.example .env
# Renseigner SAOOTI_RADIO_CIP ou SAOOTI_RADIO_ID, puis les accès.
npm start
```

Fichiers de référence dans `sample/` : `src/main.mjs` (hôte, fenêtre, sécurité et fermeture), `src/preload.mjs`, `src/renderer.mjs`, `scripts/build.mjs` (regroupement preload/renderer) et `electron-builder.config.mjs` (ressources natives et signature). Les déclarations TypeScript du paquet décrivent les options publiques.

**Reprendre uniquement le code et les éléments utiles à l'application.** Les styles de démonstration (`src/styles.css`), la mise en page, la barre d'outils, l'affichage des versions, les contrôles de logs et la fenêtre de diagnostic sont facultatifs et peuvent être remplacés par l'interface de l'application. Conserver l'intégration main/preload/renderer, les contrôles de sécurité, les ressources natives et le nettoyage nécessaires aux fonctions retenues. Importer `@saooti/radio-sdk/ui/speaker-controls.css` si les commandes d'enceintes prêtes à l'emploi sont utilisées ; leurs styles restent personnalisables.

**Sauf indication contraire, conserver l'apparence actuelle du sample pour les éléments repris.** Personnaliser leur présentation lorsqu'un autre style est demandé.

Dans ce cas, les commandes d'enceintes du SDK se stylisent depuis le CSS de l'application : variables `--saooti-radio-*` et sélecteurs sous `.saooti-radio-speakers` permettent d'adapter couleurs, polices, espacements, dimensions et disposition. Par exemple :

```css
.saooti-radio-speakers {
  --saooti-radio-surface: #263244;
  --saooti-radio-text: #fff;
  --saooti-radio-radius: 12px;
}
```

Pour consulter toutes les règles et variables CSS livrées, lire `node_modules/@saooti/radio-sdk/dist/ui/speaker-controls.css`, fourni sans minification (chemin résolu aussi par `import.meta.resolve('@saooti/radio-sdk/ui/speaker-controls.css')`). Les lignes exposent `data-speaker-id`, `data-speaker-group` et `data-status` ; la recherche expose `aria-busy`. Pour les éléments propres au sample, consulter `sample/src/index.html` et `sample/src/styles.css`.

Une interface entièrement personnalisée peut aussi utiliser `client.subscribe()` et `client.speakers`, en conservant l'orchestration du SDK. Le miniplayer distant charge ses propres styles.

Pour recevoir les paramètres séparément, utiliser `npm start -- --config=/chemin/client.env`. Pour partager le même fichier avec la construction, définir `SAOOTI_RADIO_CONFIG` avant `npm start` ou `npm run package`. Priorité : arguments de lancement, environnement, fichier, valeurs par défaut. Le fichier configure radio, plateforme, langue, paramètres URL/CIP, accès et signature Windows ; il reste hors du renderer et du paquet de l'application. `npm run package` prépare un dossier d'application ; la signature est désactivée par défaut dans l'exemple. Les configurations client ne font pas partie du dépôt de publications.

## Intégration Electron

1. **Main, avant `app.ready`** : importer `configureRadioApp` depuis `@saooti/radio-sdk/electron` et appeler `configureRadioApp(app)`.
2. **Main, après création de la fenêtre et avant chargement du renderer** : `const backend = await createNativeRadioBackend()`, puis `const host = createRadioHost({ ipcMain, backend, authentication: { username, password }, playback: { webContents: radioWindow.webContents, powerSaveBlocker }, isTrustedWebContents })`. Créer un seul backend/hôte. Garder les identifiants dans main. Vérifier dans `isTrustedWebContents` l'identité de la fenêtre et son URL exacte. Configurer `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` et `backgroundThrottling: false`.
3. **Preload** : regrouper le fichier pour le sandbox Electron :

```js
import { contextBridge, ipcRenderer } from 'electron';
import { exposeRadioBridge } from '@saooti/radio-sdk/preload';
exposeRadioBridge(contextBridge, ipcRenderer);
```

4. **Renderer** : créer les conteneurs DOM `player` et `speakers`, puis partager un seul client :

```js
import { createElectronRadioClient } from '@saooti/radio-sdk/renderer';
import { mountRadioPlayer, mountSpeakerControls } from '@saooti/radio-sdk/ui';
import '@saooti/radio-sdk/ui/speaker-controls.css';

const client = createElectronRadioClient();
await client.connect();
const player = mountRadioPlayer({ target: document.getElementById('player'), client, radioId: '6', platform: 'prod' });
const speakers = mountSpeakerControls({ target: document.getElementById('speakers'), client });
await player.ready;
```

5. **Empaquetage** : utiliser `getRadioResourceCopyPatterns()` de `@saooti/radio-sdk/electron` dans `extraResources` d'electron-builder pour copier les binaires hors ASAR. Lorsque `app.isPackaged`, passer `resourcesRoot: path.join(process.resourcesPath, RADIO_RESOURCES_DIRECTORY)` à `createNativeRadioBackend()`.
6. **Fermeture** : attendre `player.dispose()`, `speakers.dispose()` et `client.dispose()` dans le renderer, puis `host.dispose()` dans main avant de quitter.

Fournir `radioId` ou `cip` au montage. **Le CIP est prioritaire**, y compris celui de `urlParams` : le SDK vérifie son inscription et résout la radio dans main avant de charger le lecteur. En cas d'échec, aucune autre radio n'est lancée. Le paramètre `cip` explicite remplace celui de `urlParams`. `client.getState().radioId` donne la radio résolue. Dans le sample, utiliser `--cip=1234567` ou `SAOOTI_RADIO_CIP` ; sans CIP, `--radio=6` / `SAOOTI_RADIO_ID` sélectionne directement la radio.

`platform` accepte `prod`, `dev2` et `preprod` ; le miniplayer distant doit fournir Host API 3. Dans le sample, `SAOOTI_RADIO_API_BASE_URL` surcharge l'API de la plateforme choisie. Autoriser les ressources du lecteur dans CSP/CORS et `blob:` dans `script-src` pour AudioWorklet. La langue est automatique (`fr/en/it`) ou fixée avec `createElectronRadioClient({ locale: 'fr' })`.

Le SDK gère capture PCM, sélection persistante, groupes, sourdine locale et reprises. Utiliser `client.play()`, `client.pause()`, `client.stop()` et `client.speakers.select(ids)`, sans seconde orchestration. Pour vérifier l'intégration, attendre `player.ready`, lire `client.getVersions()`, sélectionner une enceinte avec les commandes et consulter `await client.getDiagnostics()` en cas d'échec. Le sample fournit les contrôles et la fenêtre de diagnostic. Statistiques et réparation du pare-feu sont facultatives et se configurent dans main.

## Modules facultatifs

Dans main, compléter la création du backend et de l'hôte de l'étape 2 avec les modules retenus. `hostOptions` reprend les options de cette étape ; `currentCip` appartient à l'application. `statisticsAuthentication` contient les identifiants OAuth `{ clientId, clientSecret }` des statistiques, distincts du compte du lecteur.

```js
import path from 'node:path';
import { app } from 'electron';
import {
  createNativeRadioBackend, createRadioHost, createRadioFileLogger,
  initRadioFirewall, RADIO_RESOURCES_DIRECTORY
} from '@saooti/radio-sdk/electron';

const resourcesRoot = app.isPackaged
  ? path.join(process.resourcesPath, RADIO_RESOURCES_DIRECTORY)
  : undefined;
const logger = createRadioFileLogger({
  directory: path.join(app.getPath('userData'), 'logs'), level: 'info'
});
const firewall = initRadioFirewall({
  programPath: process.execPath, ruleName: 'MonApplication.Radio',
  resourcesRoot, logger
});
const backend = await createNativeRadioBackend({ resourcesRoot, logger });
const host = createRadioHost({
  ...hostOptions, backend, logger, firewall,
  statistics: {
    authentication: statisticsAuthentication,
    appVersion: app.getVersion(),
    getCip: () => currentCip
  }
});
```

- **Journaux** : sans journal fourni, la console reçoit les événements au niveau `info`. Le journal fichier conserve `basic.log` et, lorsque debug est actif, `debug.log`, avec 5 Mio par fichier par défaut. Partager le même journal entre backend et hôte. Depuis le renderer, `await client.setLogLevel('debug')` change le niveau immédiatement (`off/error/warn/info/debug`). Depuis main, `await logger.exportLog('debug', exportPath)` exporte vers un chemin choisi par l'application.
- **Statistiques** : omettre `statistics` désactive l'envoi. L'hôte choisit les services selon la plateforme du lecteur et envoie les mesures système après deux minutes, puis toutes les cinq minutes. `host.getStatisticsStatus()` donne leur état ; `host.dispose()` arrête l'envoi.
- **Pare-feu Windows** : `await firewall.check()` lit l'état. Réserver `await firewall.repair()` à une action explicite dans main : elle peut demander l'UAC pour la règle TCP entrante de l'application, limitée au réseau local. Les autres plateformes renvoient `unsupported`.

Depuis le renderer, `await client.getDiagnostics()` collecte un rapport ponctuel : lecteur, services, réseau, SSDP, audio et pare-feu. `await client.restart()` redémarre la session en conservant sélection et intention de lecture. La découverte exige l'accès au réseau local et au multicast SSDP ; VPN et autorisations système doivent le permettre.

À la fermeture, après les vues et le client, terminer les modules retenus :

```js
await host.dispose();
firewall.dispose();
await logger.dispose();
```

## Signature Windows

L'application fournit son certificat et signe les copies des trois binaires SDK. Exemple electron-builder 26, exécuté sous Windows avec un certificat installé (ou un jeton et son pilote) ; définir `WINDOWS_CERTIFICATE_SUBJECT` avec le CN exact du certificat :

```js
import path from 'node:path';
import { getRadioResourceCopyPatterns, RADIO_RESOURCES_DIRECTORY, verifyRadioWindowsSignatures } from '@saooti/radio-sdk/electron';

const publisherName = process.env.WINDOWS_CERTIFICATE_SUBJECT;
if (!publisherName) throw new Error('WINDOWS_CERTIFICATE_SUBJECT requis');
export default {
  extraResources: getRadioResourceCopyPatterns(),
  win: {
    forceCodeSigning: true,
    signExts: ['.exe', '.node'],
    signtoolOptions: {
      certificateSubjectName: publisherName, publisherName,
      signingHashAlgorithms: ['sha256'],
      rfc3161TimeStampServer: 'http://timestamp.sectigo.com'
    }
  },
  async afterSign(context) {
    if (context.electronPlatformName !== 'win32') return;
    await verifyRadioWindowsSignatures({
      resourcesRoot: path.join(context.appOutDir, 'resources', RADIO_RESOURCES_DIRECTORY),
      publisherName
    });
  }
};
```

La vérification est réservée à la construction sous Windows : elle exige une signature Authenticode valide, l'éditeur attendu et un horodatage pour `radio-addon.node`, `ffmpeg.exe` et `firewall-helper.exe`. Toute absence ou erreur fait échouer la construction. `certificateSha1` permet un verrouillage facultatif du certificat. Conserver les motifs de copie par dossier ; ne pas désactiver `signExecutable` ou `signAndEditExecutable` en publication. Les manifestes SHA-256 décrivent les fichiers avant signature. L'application reste responsable de son EXE, de son installateur et de leurs vérifications.

Versions : [CHANGELOG.md](CHANGELOG.md). Logiciel propriétaire : [LICENSE](LICENSE). Avis tiers : `node_modules/@saooti/radio-sdk/resources/licenses/THIRD_PARTY_NOTICES.md`, inclus dans le SDK et copiés dans l'application avec les ressources natives.
