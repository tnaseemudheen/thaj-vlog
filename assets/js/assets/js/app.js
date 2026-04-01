// assets/js/app.js
const App = (function () {
  const API_KEY = (window.CONFIG && window.CONFIG.API_KEY) || "";
  const CHANNEL_ID = (window.CONFIG && window.CONFIG.CHANNEL_ID) || "";
  const DEFAULT_MAX = (window.CONFIG && window.CONFIG.DEFAULT_MAX) || 12;

  function ensureConfig() {
    if (!API_KEY || !CHANNEL_ID) throw new Error("Missing CONFIG.API_KEY or CONFIG.CHANNEL_ID");
  }

  async function safeFetch(url) {
    const res = await fetch(url);
    const data = await res.json().catch(()=>null);
    if (!res.ok) {
      const msg = data && data.error && data.error.message ? data.error.message : res.statusText || 'Fetch error';
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error.message || 'API error');
    return data;
  }

  function getVideoId(item) {
    if (!item || !item.id) return null;
    if (typeof item.id === 'string') return item.id;
    if (item.id.videoId) return item.id.videoId;
    return null;
  }

  function chunkArray(arr, size = 50) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async function fetchChannelStats() {
    ensureConfig();
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${CHANNEL_ID}&key=${API_KEY}`;
    return safeFetch(url).then(d => d.items && d.items[0] ? d.items[0] : null);
  }

  async function fetchVideosPage({ maxResults = DEFAULT_MAX, pageToken = "" } = {}) {
    ensureConfig();
    const url = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&type=video&maxResults=${maxResults}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    return safeFetch(url);
  }

  async function fetchVideoDetails(videoIds = []) {
    if (!videoIds || !videoIds.length) return [];
    ensureConfig();
    // videos.list accepts up to 50 ids; batch if necessary
    const chunks = chunkArray(videoIds, 50);
    const results = [];
    for (const chunk of chunks) {
      const url = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&part=contentDetails,statistics&id=${chunk.join(",")}`;
      const data = await safeFetch(url);
      if (data && Array.isArray(data.items)) results.push(...data.items);
    }
    return results;
  }

  function isoToSeconds(iso) {
    if (!iso) return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] || 0, 10), mm = parseInt(m[2] || 0, 10), s = parseInt(m[3] || 0, 10);
    return h * 3600 + mm * 60 + s;
  }

  async function fetchVideosWithDetails({ maxResults = DEFAULT_MAX, pageToken = "" } = {}) {
    const search = await fetchVideosPage({ maxResults, pageToken });
    const items = (search.items || []);
    const ids = items.map(getVideoId).filter(Boolean);
    const details = ids.length ? await fetchVideoDetails(ids) : [];
    const map = new Map(details.map(d => [d.id, d]));
    const combined = items.map(it => {
      const vid = getVideoId(it);
      return { id: vid, snippet: it.snippet, details: map.get(vid) || null };
    });
    return { items: combined, nextPageToken: search.nextPageToken || null };
  }

  async function fetchShorts({ maxResults = 50 } = {}) {
    const search = await fetchVideosPage({ maxResults });
    const items = (search.items || []);
    const ids = items.map(getVideoId).filter(Boolean);
    if (!ids.length) return [];
    const details = await fetchVideoDetails(ids);
    // Filter durations <= 60s
    const shortIds = details.filter(d => isoToSeconds(d.contentDetails.duration) <= 60).map(d => d.id);
    const snippetMap = new Map(items.map(i => [getVideoId(i), i.snippet]));
    return shortIds.map(id => ({ id, snippet: snippetMap.get(id) || {}, details: details.find(d => d.id === id) }));
  }

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderVideoCards(items, container, append = false) {
    if (!container) return;
    if (!append) container.innerHTML = '';
    if (!items || !items.length) {
      container.innerHTML = '<div class="error">No videos found</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(it => {
      const id = it.id;
      const title = it.snippet && it.snippet.title ? it.snippet.title : 'Untitled';
      const thumb = it.snippet && it.snippet.thumbnails && (it.snippet.thumbnails.high?.url || it.snippet.thumbnails.default?.url) ? (it.snippet.thumbnails.high?.url || it.snippet.thumbnails.default?.url) : '';
      const date = it.snippet && it.snippet.publishedAt ? new Date(it.snippet.publishedAt).toLocaleDateString() : '';
      const a = document.createElement('a');
      a.className = 'card';
      a.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = `
        <div class="thumb"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(title)}" loading="lazy"></div>
        <div class="card-body">
          <h4>${escapeHtml(title)}</h4>
          <div class="meta">${escapeHtml(date)}</div>
        </div>
      `;
      frag.appendChild(a);
    });
    container.appendChild(frag);
  }

  function renderShortCards(items, container) {
    if (!container) return;
    container.innerHTML = '';
    if (!items || !items.length) {
      container.innerHTML = '<div class="error">No shorts found</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(it => {
      const id = it.id;
      const thumb = it.snippet && it.snippet.thumbnails && (it.snippet.thumbnails.high?.url || it.snippet.thumbnails.default?.url) ? (it.snippet.thumbnails.high?.url || it.snippet.thumbnails.default?.url) : '';
      const a = document.createElement('a');
      a.className = 'short';
      a.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = `<div class="short-thumb"><img src="${escapeHtml(thumb)}" alt="" loading="lazy"></div>`;
      frag.appendChild(a);
    });
    container.appendChild(frag);
  }

  function renderFeatured(container, item) {
    if (!container) return;
    if (!item || !item.id) { container.innerHTML = '<div class="error">No featured</div>'; return; }
    const id = item.id;
    const title = item.snippet && item.snippet.title ? item.snippet.title : '';
    container.innerHTML = `
      <div class="featured-card">
        <iframe src="https://www.youtube.com/embed/${encodeURIComponent(id)}" title="${escapeHtml(title)}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
        <h3>${escapeHtml(title)}</h3>
      </div>
    `;
  }

  function initThemeButtons() {
    document.querySelectorAll('.lt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('thaj-theme', theme);
      });
    });
    const saved = localStorage.getItem('thaj-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  }

  async function init() {
    initThemeButtons();
    try {
      const ch = await fetchChannelStats();
      if (ch && ch.statistics) {
        const s = ch.statistics;
        const subs = s.subscriberCount || 0;
        const vcount = s.videoCount || 0;
        const views = s.viewCount || 0;
        document.querySelectorAll('#subs').forEach(e => e && (e.textContent = numFmt(subs)));
        document.querySelectorAll('#videosCount').forEach(e => e && (e.textContent = numFmt(vcount)));
        document.querySelectorAll('#views').forEach(e => e && (e.textContent = numFmt(views)));
        document.querySelectorAll('#meta-subs').forEach(e => e && (e.textContent = 'Subscribers: ' + numFmt(subs)));
        document.querySelectorAll('#meta-vids').forEach(e => e && (e.textContent = 'Videos: ' + numFmt(vcount)));
        document.querySelectorAll('#meta-views').forEach(e => e && (e.textContent = 'Views: ' + numFmt(views)));
      }
      const featuredSlot = document.getElementById('featured');
      if (featuredSlot) {
        const res = await fetchVideosWithDetails({ maxResults: 6 });
        if (res && res.items && res.items.length) renderFeatured(featuredSlot, res.items[0]);
      }
    } catch (err) {
      console.error('App.init error', err);
    }
  }

  function numFmt(v) {
    if (v === undefined || v === null) return '—';
    v = Number(v);
    if (isNaN(v)) return '—';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return String(v);
  }

  return {
    init,
    fetchChannelStats,
    fetchVideosPage,
    fetchVideoDetails,
    fetchVideosWithDetails,
    fetchShorts,
    renderVideoCards,
    renderShortCards,
    renderFeatured
  };
})();
