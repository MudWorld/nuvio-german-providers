import { request, getJson, provider } from '../../shared/http.js';
import { resolveEmbed } from '../../shared/extractors/index.js';

const BASE = 'https://huhu.to';
const LANG = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch', ja: 'Japanisch', jp: 'Japanisch' };

// huhu.to moved from MediaURL (POST /mediaurl-source.json, now 503) to mHub Addon Protocol v2: GET
// /vod/source/{type}/tmdb:{id}[:season:episode].json, keyed by the TMDB id alone, so no TMDB lookup is needed
async function sources(tmdbId, mediaType, season, episode) {
    const id = mediaType === 'tv' ? `series/tmdb:${tmdbId}:${season}:${episode}` : `video/tmdb:${tmdbId}`;
    return (await getJson(`${BASE}/vod/source/${id}.json?language=de&region=DE`)).sources || [];
}

// HuhuToExtractor: huhu.to links only redirect to the real hoster
async function resolve(src) {
    let url = src.url;
    if (url.includes('huhu.to/')) url = (await request(url)).url;
    return (await resolveEmbed(url, `${BASE}/`)).map(s => ({
        name: 'Huhu',
        title: `${s.host} · ${(src.languages || ['de']).map(l => LANG[l] || l.toUpperCase()).join('/')}`,
        url: s.url,
        quality: /\d/.test(s.quality) ? s.quality : (/^\d{3,4}p$/.test(src.quality) ? src.quality : 'auto'),
        headers: s.headers,
    }));
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        // German sources first: Nuvio TV runs a plugin's requests one after the other
        const german = s => ((s.languages || ['de']).includes('de') ? 0 : 1);
        const list = (await sources(tmdbId, mediaType, season, episode)).filter(s => s.url).sort((a, b) => german(a) - german(b));
        return [].concat(...await Promise.all(list.map(s => resolve(s).catch(() => []))));
    } catch (e) {
        console.error(`[Huhu] ${e.message}`);
    }
    return [];
}

module.exports = provider(getStreams);
