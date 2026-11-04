#!/usr/bin/env node
// node health.js [--json out.json] [--datacenter] [provider...]   runs test.js for every case in health.json (four at a time) and
// prints one line per case; with --json also writes {checkedAt, country, results:[{provider, title, ok, streams, playable, note}]}.
// A case is ok when at least one returned stream probes as PLAYABLE. Needs TMDB_API_KEY or .tmdb_key like test.js.
// --datacenter (the nightly run on the server) skips cases marked "datacenter": false: those sites block data-centre IPs.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const out = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null;
const datacenter = args.includes('--datacenter');
const only = args.filter(a => a !== '--datacenter');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'health.json'), 'utf8')).cases
    .filter(c => !only.length || only.includes(c.provider))
    .filter(c => !(datacenter && c.datacenter === false));

function run(c) {
    const argv = [path.join(__dirname, 'test.js'), c.provider, String(c.tmdb), c.type].concat(c.type === 'tv' ? [String(c.season), String(c.episode)] : []);
    return new Promise(resolve => {
        // test.js waits for still-open hoster sockets after it has answered, so the result is read from its output
        execFile(process.execPath, argv, { cwd: __dirname, timeout: 90000, maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
            const text = `${stdout}\n${stderr}`;
            const streams = Number((text.match(/^(\d+) stream\(s\)/m) || [])[1] || 0);
            const playable = (text.match(/^PLAYABLE /gm) || []).length;
            const note = text.split('\n').filter(l => /^\[|ERROR|CHECK|CRASH/.test(l)).slice(0, 4).join(' | ').slice(0, 400);
            resolve({ provider: c.provider, title: c.title, type: c.type, ok: playable > 0, streams, playable, note: streams || !err ? note : (note || String(err.message).slice(0, 200)) });
        });
    });
}

async function main() {
    const results = [];
    for (let i = 0; i < cases.length; i += 4) results.push(...await Promise.all(cases.slice(i, i + 4).map(run)));
    let country = '?';
    try { country = (await (await fetch('https://ipinfo.io/country')).text()).trim(); } catch (e) { /* offline */ }
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.provider.padEnd(13)} ${String(r.playable).padStart(2)}/${String(r.streams).padEnd(2)} ${r.title}${r.ok ? '' : '  ' + r.note}`);
    console.log(`country ${country}, ${results.filter(r => r.ok).length}/${results.length} ok`);
    if (out) fs.writeFileSync(out, JSON.stringify({ checkedAt: new Date().toISOString(), country, results }, null, 2));
    process.exitCode = results.every(r => r.ok) ? 0 : 1;
}

main();
