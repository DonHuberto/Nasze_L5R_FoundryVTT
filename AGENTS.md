# Repository instructions

## Release contract

After every change intended for publication, run the complete test and validation suite, bump the manifest version, update `CHANGELOG.md`, build the package, inspect its contents, create an intentional commit, push it, and create a GitHub Release.

The release must contain the manifest (`system.json`) and exactly the ZIP archive whose basename is used by the manifest `download` URL. The `manifest` field must use the stable `releases/latest/download/...` URL, `download` must use the versioned release tag, and `changelog` must point to the public changelog.

Create a draft release first. Do not publish when tests, links, archive contents, version numbers, or asset downloads fail validation. Verify the public manifest and ZIP URLs after publication before reporting success.
