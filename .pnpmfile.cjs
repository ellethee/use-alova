// TypeDoc 0.28 supports TypeScript <= 6.0 only and needs the TS JS API, which TypeScript 7 does not have.
// TypeDoc therefore gets the TS 6 build (`@typescript/typescript6`) as its own `typescript`, while the
// project itself uses TypeScript 7. Remove this hook when TypeDoc supports TypeScript 7.
function readPackage(pkg) {
  if (pkg.name === 'typedoc') {
    delete pkg.peerDependencies.typescript
    pkg.dependencies = { ...pkg.dependencies, typescript: 'npm:@typescript/typescript6@^6.0.2' }
  }
  return pkg
}

module.exports = { hooks: { readPackage } }
