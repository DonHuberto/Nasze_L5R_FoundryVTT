# Installation

## System Installation

### Installation directly on Foundry with search (Recommended)

1. Open FoundryVTT.
2. In the `Game Systems` tab, click `Install system`.
3. Search for `L5R`, on the line `Legend of the Five Rings (5th Edition)`, click `Install`.

### Installation on Forge

1. Navigate to the `Systems` section in the Bazaar.
2. Search for `L5R` on the filter line.  **Note**: Install `Legend of the Five Rings (5th Edition)` **not** `Legend of the Five Rings (5E)` due to it being deprecated
3. Once installed, you can now start a Forge instance with it installed.

### With the manifest

1. Open FoundryVTT.
2. In the `Game Systems` tab, click `Install system`.
3. Copy this link and use it in the `Manifest URL`, then click `Install`: [https://gitlab.com/teaml5r/l5r5e/-/raw/master/system/system.json](https://gitlab.com/teaml5r/l5r5e/-/raw/master/system/system.json)

## Modules

L5R does not require a lot of modules and it is highly encourage you to start with a small number of them.

Some modules require others libraries/modules and you need to install the dependency modules for them to work.  Nothing fancy, just accept when FoundryVTT prompts you to download or activate the dependencies.

The following is a list of recommended modules.  Note that a module that is outdated isn't *necessarily* unusable; however, you may find integration/interaction errors with the more current versions of Foundry and generally Forge will not allow installations of modules that aren't verified for the installed version of Foundry if **Game Management** is enabled.

### Recommended Modules

| Module name | Notes | Module Status |
| :------------ | :------ | :-------------- |
| [Babele](https://foundryvtt.com/packages/babele) | Required for non-English compendium translations | Verified for v13+ |
| [Ownership Viewer](https://foundryvtt.com/packages/permission_viewer) | Lets you see instantly who has permissions to see what item | Verified for v13+ |
| [Dice So Nice!](https://foundryvtt.com/packages/dice-so-nice) | Add 3D dices that bounce on the screen when you roll | Verified for v13+ |
| [Small Legend of the 5 Rings Tools](https://foundryvtt.com/packages/l5r-dragruler) | Series of tools for L5R | This module is no longer available |
| [Search Anywhere](https://foundryvtt.com/packages/searchanywhere) | Don't spent too much time searching the right technique | This module is outdated (Verified v9).  Alternative: [Spotlight Omnisearch](https://foundryvtt.com/packages/spotlight-omnisearch)  |
| [FXMaster](https://foundryvtt.com/packages/fxmaster) | More effects | Verified for v13+ |
| [Scene Clicker](https://foundryvtt.com/packages/scene-clicker) | Clicking on a Scene or a Scene Link will now "view" the Scene instead of rendering the Scene Config Sheet | This module is outdated (verified v9).  Alternative: [Monk's Scene Navigation](https://foundryvtt.com/packages/monks-scene-navigation) |
| [Universal Battlemap Importer](https://foundryvtt.com/packages/dd-import) | Allows Importing [DungeonDraft](https://dungeondraft.net/), [DungeonFog](https://www.dungeonfog.com/) or [Arkenforge](https://arkenforge.com/) export files into FoundryVTT | Verified for v13+ |
| [Compendium Folders](https://foundryvtt.com/packages/compendium-folders) | Add folders to compendiums | This module is outdated (Verified v11).  Generally not needed since folder support is now enabled.
| [Chat Images](https://foundryvtt.com/packages/chat-images) | Lets you drag images into the chat, one of the quicker ways to do 'he looks like this' | Verified for v13+ |
| [Combat Utility Belt](https://foundryvtt.com/packages/combat-utility-belt) | A totally over-engineered but helpful app that will, among other things, let you set up custom statuses | This project is abandoned and has multiple integration errors with v13.  Use at your own risk. |
| [Timer](https://foundryvtt.com/packages/timer) | A simple timer, useful to stress your players a bit. | Verified for v13+ |

### Map Module

The official 5e Rokugan map is publish under the module section in FoundryVTT.  It is also available for download on Forge.

- [L5R5e - Rokugan map for Legend of the Five Rings (5th edition)](https://foundryvtt.com/packages/l5r5e-map)

## Worlds

We have published the official free content in form of worlds ready to play :

- [L5R5E - Cresting Waves](https://foundryvtt.com/packages/l5r5e-world-waves)
- [L5R5E - In the Palace of the Emerald Champion](https://foundryvtt.com/packages/l5r5e-world-palace)
- [L5R5E - The Highwayman](https://foundryvtt.com/packages/l5r5e-world-highwayman)
- [L5R5E - The Scroll or the Blade](https://foundryvtt.com/packages/l5r5e-world-scroll)
- [L5R5E - The Knotted Tails](https://foundryvtt.com/packages/l5r5e-world-tails)
- [L5R5E - Wedding at Kyotei castle](https://foundryvtt.com/packages/l5r_mariage)
