# Releasing

One version for the whole pack (CLI, skills, plugin). Order matters: the plugin hooks pin the
npm version, so **npm must publish before the marketplace changes**.

1. `node scripts/versions.mjs <x.y.z>` — bumps cli/package.json, plugin.json, marketplace.json and the pins in hooks/hooks.json.
2. `npm test && npm run check && npm run versions`.
3. Commit, tag `v<x.y.z>`.
4. `cd cli && npm publish` (prepack bundles the skills, README and LICENSE).
5. `npm view rulebook-cli@<x.y.z> version` must answer before going on.
6. Push the commit and the tag. The marketplace and skills.sh read the repository.
