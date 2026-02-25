# Updating - Bests practices

- Anytime you update to a major version:
  - **Foundry**: make a backup of foundry's data directory (default : `%localappdata%/FoundryVTT/data/`).
  - **Forge**: you will be prompted on Foundry upgrades (both major and minor) to download a local copy of the world for backup.  It is recommended you complete this step to avoid data loss.
- It is recommended that you wait for some time before a major upgrade (ex FoundryVTT v9 -> v10) when a new version is released.  This are a number of reasons to avoid immediate upgrades:
  - Several modules your world uses will have a lot of bugs introduced that aren't fully corrected in the first few patches.
  - Several systems/modules won't update quickly, will be incompatible with the current Foundry version, or left untested (the developers for a many of modules and systems only make updates in their free time).
  - A solid recommendation for update delay should be somewhere in the range of 2 weeks to 1 month, if not longer.  Generally, this is less of a concern with minor upgrades which don't change core systems in Foundry.
  - Make sure you check the compatibility of your world's modules with the new versions and potentially disable certain modules if there is little chance of a near-term update.  A good tool to use for managing modules profiles is [Module Profiles](https://foundryvtt.com/packages/module-profiles) to ensure that game-breaking modules can be deactivated by having a master profile.
