# System helping (Contribute)
## Rules
You are free to contribute and propose corrections and modifications after forking the repository. Try to respect these rules:

- Make sure you are up-to-date with the reference branch (generally this is the `dev` branch).
- Clear and precise commit messages allow a quick review of the code.  For fixes, recommend the testing steps for a reviewer to properly test the fix.
- If possible, limit yourself to one Feature per Merge request to avoid slowing down the review process with multiple feature commits.

## Dev Install

1. Clone the repository to your local machine.
2. Ensure that [Node.js](https://nodejs.org/en/download/) is installed.
3. Use `npm ci` to install the relevant dependencies.
4. Create a link from `<repo>/system` to your foundry system data (by default `%localappdata%/FoundryVTT/data/systems/l5r5e`).

Windows example (modify the target and source directories, and run this in administrator):

```bash
mklink /D /J "%localappdata%/FoundryVTT/data/systems/l5r5e" "D:/Projects/FVTT/l5r5e/system"
```

## Compiling SCSS

1. Run `npm run watch` to watch and compile the `*.scss` files.
