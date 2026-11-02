#!/usr/bin/env bash
# Exercise the exact npm package archive while 1.2.0 awaits publication.
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
package_dir="$(mktemp -d)"
trap 'rm -rf "$package_dir"' EXIT
cd "$repo_dir"
npm pack --pack-destination "$package_dir"
npm ci --prefix demo
package_version="$(node -p 'require("./package.json").version')"
npm install --prefix demo --no-save --package-lock=false --ignore-scripts "$package_dir/rootcap-$package_version.tgz"
node --input-type=module -e 'import {readFileSync, realpathSync} from "node:fs"; import {resolve} from "node:path"; const p=resolve("demo/node_modules/rootcap"); const m=JSON.parse(readFileSync(resolve(p,"package.json"))); const expected=JSON.parse(readFileSync("package.json")).version; if(m.version!==expected || realpathSync(p)!==p) throw Error("Demo must use the packed rootcap version, not a workspace link"); console.log(`Demo uses packed rootcap ${m.version}`);'
