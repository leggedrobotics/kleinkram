// Moves every exact version pin in the workspace's package.json files to the
// newest stable release in the same major (same minor for 0.x), keeping the
// pin exact. `pnpm update -r` leaves exact pins alone, so without this they
// would never move.
//
// Pre-release pins (e.g. 5.0.0-beta.2) are deliberate and left untouched.
// Run `pnpm install` afterwards to update the lockfile.
//
// Usage: node .github/scripts/update-exact-pins.mjs

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];
const STABLE = /^(\d+)\.(\d+)\.(\d+)$/;

const manifests = [
    'package.json',
    'backend/package.json',
    'frontend/package.json',
    'queueConsumer/package.json',
    'docs/package.json',
    ...readdirSync('packages').map((name) => `packages/${name}/package.json`),
];

const parse = (version) => STABLE.exec(version)?.slice(1, 4).map(Number);

const newer = (a, b) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
};

const versionCache = new Map();
const publishedVersions = (name) => {
    if (!versionCache.has(name)) {
        const out = execFileSync('npm', ['view', name, 'versions', '--json'], {
            encoding: 'utf8',
        });
        const list = JSON.parse(out);
        versionCache.set(name, Array.isArray(list) ? list : [list]);
    }
    return versionCache.get(name);
};

// Newest stable version with the same major (and same minor for 0.x).
const latestCompatible = (name, current) => {
    let best = current;
    for (const candidate of publishedVersions(name)) {
        const v = parse(candidate);
        if (!v || v[0] !== current[0]) continue;
        if (current[0] === 0 && v[1] !== current[1]) continue;
        if (newer(v, best)) best = v;
    }
    return best.join('.');
};

let changed = 0;
for (const file of manifests) {
    const text = readFileSync(file, 'utf8');
    const json = JSON.parse(text);
    let fileChanged = false;

    for (const field of DEP_FIELDS) {
        for (const [name, spec] of Object.entries(json[field] ?? {})) {
            const current = parse(spec);
            if (!current) continue; // ranges, workspace:*, pre-releases
            const target = latestCompatible(name, current);
            if (target !== spec) {
                console.log(`${file}: ${name} ${spec} -> ${target}`);
                json[field][name] = target;
                fileChanged = true;
                changed++;
            }
        }
    }

    if (fileChanged) {
        const indent = /^(\s+)"/m.exec(text)?.[1] ?? '    ';
        writeFileSync(file, JSON.stringify(json, null, indent) + '\n');
    }
}

console.log(`${changed} exact pin(s) updated`);
