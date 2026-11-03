import { getJson, provider } from '../../shared/http.js';
import { getMeta } from '../../shared/tmdb.js';
import { pickBest } from '../../shared/match.js';

const BASE = 'https://filmfrei24.com';
const API = BASE + '/beta/api.php';

// the inlined `const ALL_FILMS` catalog is gone; the page now loads it from api.php (no TMDB ids any more, only
// slugs such as "Inception"), and the video URL comes from ?q=play per film or episode
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const tv = mediaType === 'tv';
        if (tv && (!season || !episode)) return [];
        const [catalog, meta] = await Promise.all([getJson(`${API}?q=catalog&part=core`), getMeta(tmdbId, mediaType)]);
        const hit = pickBest((tv ? catalog.series : catalog.films) || [], meta);
        if (!hit) return [];
        const play = await getJson(`${API}?q=play&type=${tv ? 's' : 'f'}&id=${encodeURIComponent(hit.id)}${tv ? `&season=${season}&ep=${episode}` : ''}`);
        const url = play.ok && play.src;
        if (!url || !/^https?:/.test(url)) return [];
        return [{
            name: 'FilmFrei24',
            title: `${hit.lang || 'Deutsch'} · ${/\.m3u8/.test(url) ? 'HLS' : 'MP4'}`,
            url,
            quality: hit.quality === 'HD' ? '1080p' : 'auto',
            headers: { Referer: BASE + '/' },
        }];
    } catch (e) {
        console.error(`[FilmFrei24] ${e.message}`);
    }
    return [];
}

module.exports = provider(getStreams);
