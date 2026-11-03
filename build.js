#!/usr/bin/env node
// node build.js [provider...] [--minify]  ->  src/<id>/index.js bundled to providers/<id>.js
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const minify = args.includes('--minify');
const srcDir = path.join(__dirname, 'src');
const ids = args.filter(a => !a.startsWith('-'));
const providers = ids.length ? ids : fs.readdirSync(srcDir).filter(d => fs.existsSync(path.join(srcDir, d, 'index.js')));

let failed = 0;
for (const id of providers) {
    try {
        esbuild.buildSync({
            entryPoints: [path.join(srcDir, id, 'index.js')],
            outfile: path.join(__dirname, 'providers', `${id}.js`),
            bundle: true,
            format: 'cjs',
            platform: 'neutral',
            target: 'es2016', // async/await -> generators for Nuvio's JS engines
            external: ['cheerio', 'crypto-js'],
            minify,
            logLevel: 'error',
        });
        console.log(`ok   ${id}`);
    } catch (e) {
        failed++;
        console.error(`FAIL ${id}: ${e.message}`);
    }
}

const manifestPath = path.join(__dirname, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const s of manifest.scrapers) {
    if (!fs.existsSync(path.join(__dirname, s.filename))) { failed++; console.error(`FAIL manifest: ${s.filename} missing`); }
}

// each scraper's testCase (what the WatchParty apps' diagnostics run) is the first health.json case of that provider,
// so health.json stays the one list of test titles
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'health.json'), 'utf8')).cases;
for (const s of manifest.scrapers) {
    const c = cases.find(x => x.provider === s.id);
    if (c) s.testCase = Object.assign({ tmdb: String(c.tmdb), type: c.type }, c.type === 'tv' ? { season: c.season, episode: c.episode } : {}, { title: c.title });
    else delete s.testCase;
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
process.exitCode = failed ? 1 : 0;
