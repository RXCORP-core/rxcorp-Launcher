<div align="center">
  <img src="src/assets/images/icon/icon.png" width="96" height="96" alt="RXCORP Launcher Logo">
  <h1>RXCORP Launcher 2.0</h1>
  <p><strong>Le Launcher Minecraft Tout-en-1 nouvelle génération pour l'écosystème RXCORP</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Version-2.0.0-8b5cf6?style=for-the-badge" alt="Version">
    <img src="https://img.shields.io/badge/Electron-40.0-06b6d4?style=for-the-badge" alt="Electron">
    <img src="https://img.shields.io/badge/Pelican-Integrated-10b981?style=for-the-badge" alt="Pelican">
    <img src="https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge" alt="License">
  </p>
</div>

---

## 🌟 Présentation

**RXCORP Launcher** est une application moderne, ultra-fluide et légère conçue pour éliminer toute friction entre les joueurs et leurs serveurs Minecraft. 

Fini les galères de mods incompatibles : le launcher se synchronise en temps réel avec votre hébergement **Pelican Cloud**, télécharge les mods nécessaires en 1 clic et vous connecte directement à vos serveurs.

---

## ⚡ Fonctionnalités Clés

### 🌐 1. RXCORP Cloud (Intégration Pelican Panel)
* **Détection automatique** : Vos serveurs Minecraft loués sur RXCORP apparaissent instantanément.
* **Monitoring en direct** : Statut du serveur (🟢 En ligne / 🔴 Hors-ligne), RAM consommée et charge CPU en temps réel.
* **Synchronisation Magique 1-Clic** : Le launcher scanne le dossier `/mods` de votre serveur via l'API Pelican, télécharge les mods manquants à pleine vitesse et vous connecte automatiquement à l'adresse IP et au port du serveur !

### 🎮 2. Gestionnaire Multi-Instances
* Créez et gérez des profils de jeu indépendants en quelques clics.
* Support complet de tous les modloaders : **Vanilla**, **Fabric**, **Forge** et **NeoForge**.
* Versions supportées : de la **1.8.9** à la dernière **1.21.x**.
* Gestion isolée des dossiers `mods/`, `config/` et `saves/`.

### 🔍 3. Navigateur Modrinth Intégré
* Moteur de recherche direct connecté à l'API officielle de **Modrinth**.
* Filtres intelligents par version de Minecraft et type de modloader.
* Installation de mods en 1 clic directement dans l'instance de votre choix.

### ⚔️ 4. Mode PvP & Optimisation FPS
* Liste sélectionnée des meilleurs mods d'optimisation et PvP activables par de simples interrupteurs ON/OFF :
  * ⚡ **Sodium / Embeddium** : Multiplie les FPS par 3 à 5 grâce au moteur de rendu nouvelle génération.
  * 🔋 **Lithium / FerriteCore** : Réduction drastique de l'empreinte mémoire RAM et optimisation des calculs.
  * ✨ **Iris / Oculus** : Prise en charge fluide des Shaders.
  * 🔍 **Zoomify** : Zoom fluide paramétrable (touche C).
  * 🍎 **AppleSkin** : Affichage précis de la faim et de la saturation.
  * 💡 **FullBright** : Vision nocturne permanente dans les cavernes.
  * 🎙️ **Simple Voice Chat** : Chat vocal de proximité immersif 3D.

### 👤 5. Gestion des Comptes
* Connexion officielle **Microsoft Xbox Live** (OAuth2 sécurisé).
* Mode **Hors-Ligne / Pseudo** pour le développement et les tests.
* Changement de compte rapide depuis la barre supérieure.

---

## 🚀 Démarrage & Développement

### Prérequis
* **Node.js** (v20+ recommandé)
* **npm** ou **pnpm**
* **Java** (Java 17/21/25 pour Minecraft moderne)

### Installation
```bash
# Cloner le dépôt
git clone https://github.com/RXCORP-core/rxcorp-Launcher.git
cd rxcorp-Launcher

# Installer les dépendances
npm install
```

### Lancer en mode développement
```bash
npm start
```

### Compiler les exécutables (.exe / .AppImage / .dmg)
```bash
npm run build
```

---

## 🔒 Sécurité & Confidentialité
* Les clés API et identifiants sont stockés localement sur la machine de l'utilisateur via `electron-store`.
* Aucune donnée confidentielle n'est transmise à des serveurs tiers en dehors des APIs officielles (Pelican Panel, Modrinth, Microsoft Xbox).

---

<div align="center">
  <p>© 2026 <strong>RXCORP</strong> — Infrastructure & Solutions Gaming Cloud.</p>
</div>
