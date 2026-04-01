// assets/js/app.js
const App = (function () {
  const API_KEY = (window.CONFIG && window.CONFIG.API_KEY) || "";
  const CHANNEL_ID = (window.CONFIG && window.CONFIG.CHANNEL_ID) || "";
  const DEFAULT_MAX = (window.CONFIG && window.CONFIG.DEFAULT_MAX) || 12;

  function throwIfMissing() {
    if (!API_KEY || !CHANNEL_ID) throw new Error("API_KEY or CHANNEL_ID missing in CONFIG");
  }

  async function safeFetch(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  }

  function fmt(n) {
    if (n === undefined || n === null) return "—";
    n = Number(n);
    if (isNaN(n)) return "—";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toString();
  }

  async function fetchChannelStats() {
    throwIfMissing();
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${CHANNEL_ID}&key=${API_KEY}`;
    const data = await safeFetch(url);
    return data.items && data.items[0] ? data.items[0] : null;
  }

  async function fetchVideosPage({ maxResults = DEFAULT_MAX, pageToken = "" } = {}) {
    throwIfMissing();
    const url = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&type=video&maxResults=${maxResults}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    return safeFetch(url);
  }

  async function fetchVideoDetails(videoIds = []) {
    if (!videoIds || !videoIds.length) return [];
    const ids = videoIds.join(",");
    const url = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&part=contentDetails,statistics&id=${ids}`;
    const data = await safeFetch(url);
    return data.items || [];
  }

  function parseISO8601Duration(iso) {
    if (!iso) return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] || 0, 10);
    const min = parseInt(m[2] || 0, 10);
    const s = parseInt(m[3] || 0, 10);
    return h * 3600 + min * 60 + s;
  }

  async function fetchVideosWithDetails({ maxResults = DEFAULT_MAX, pageToken = "" } = {}) {
    const search = await fetchVideosPage({ maxResults, pageToken });
    const ids = (search.items || []).map(i => i.id && (i.id.videoId || i.id)).filter(Boolean);
    const details = ids.length ? await fetchVideoDetails(ids) : [];
    const dmap = new Map(details.map(d => [d.id, d]));
    const combined = (search.items || []).map(i => {
      const id = i.id && (i.id.videoId || i.id);
      return { id, snippet: i.snippet, details: dmap.get(id) || null };
    });
    return { items: combined, nextPageToken: search.nextPageToken || null };
  }

  async function fetchShorts({ maxResults = 50 } = {}) {
    const search = await fetchVideosPage({ maxResults });
    const ids = (search.items || []).map(i => i.id && (i.id.videoId || i.id)).filter(Boolean);
    if (!ids.length) return [];
    const details = await fetchVideoDetails(ids);
    const shortIds = details.filter(d => parseISO8601Duration(d.contentDetails.duration) <= 60).map(d => d.id);
    const snippetMap = new Map((search.items || []).map(i => [i.id.videoId, i.snippet]));
    return shortIds.map(id => ({ id, snippet: snippetMap.get(id) || {}, details: details.find(d => d.id === id) }));
  }

  function escapeHtml(s='') {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderVideoCards(items, container, append = false) {
    if (!container) return;
    if (!append) container.innerHTML = "";
    if (!items || !items.length) {
      container.innerHTML = '<div class="error-msg">No videos found</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(it => {
      const id = it.id;
      const title = it.snippet.title || "Untitled";
      const thumb = it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.default?.url || "";
      const date = it.snippet.publishedAt ? new Date(it.snippet.publishedAt).toLocaleDateString() : "";
      const a = document.createElement('a');
      a.className = "video-card";
      a.href = `https://www.youtube.com/watch?v=${id}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `
        <div class="video-thumbnail">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(title)}" loading="lazy"/>
          <div class="play-icon">▶</div>
        </div>
        <div class="video-info">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(date)}</p>
        </div>
      `;
      frag.appendChild(a);
    });
    container.appendChild(frag);
  }

  function renderShortCards(items, container) {
    if (!container) return;
    container.innerHTML = "";
    if (!items || !items.length) {
      container.innerHTML = '<div class="error-msg">No shorts found</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(it => {
      const id = it.id;
      const thumb = it.snippet.thumbnails?.high?.url || "";
      const a = document.createElement('a');
      a.className = "short-card";
      a.href = `https://www.youtube.com/watch?v=${id}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `
        <div class="short-thumbnail">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(it.snippet.title||'')}" loading="lazy"/>
          <div class="short-play">▶</div>
        </div>
      `;
      frag.appendChild(a);
    });
    container.appendChild(frag);
  }

  function renderFeatured(container, item) {
    if (!container) return;
    if (!item) {
      container.innerHTML = '<div class="error-msg">Featured not available</div>';
      return;
    }
    const id = item.id;
    const title = item.snippet.title || "";
    container.innerHTML = `
      <div class="featured">
        <iframe class="featured-iframe" src="https://www.youtube.com/embed/${id}" title="${escapeHtml(title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        <h3 class="featured-title">${escapeHtml(title)}</h3>
        <p class="featured-meta">${new Date(item.snippet.publishedAt).toLocaleDateString()}</p>
      </div>
    `;
  }

  function initThemeToolbar() {
    document.querySelectorAll('.lt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-theme');
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('thaj-theme', t);
      });
    });
    const saved = localStorage.getItem('thaj-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  }

  async function init() {
    try {
      initThemeToolbar();
      throwIfMissing();
      const ch = await fetchChannelStats();
      if (ch) {
        const stats = ch.statistics || {};
        const subsEls = document.querySelectorAll('#stat-subs, #subs, #meta-subs');
        subsEls.forEach(e => e && (e.textContent = fmt(stats.subscriberCount)));
        const viewsEls = document.querySelectorAll('#stat-views, #views, #meta-views');
        viewsEls.forEach(e => e && (e.textContent = fmt(stats.viewCount)));
        const vidsEls = document.querySelectorAll('#stat-videos, #vids, #meta-vids');
        vidsEls.forEach(e => e && (e.textContent = fmt(stats.videoCount)));
        document.querySelectorAll('#meta-subs').forEach(e => e && (e.textContent = 'Subscribers: ' + fmt(stats.subscriberCount)));
        document.querySelectorAll('#meta-vids').forEach(e => e && (e.textContent = 'Videos: ' + fmt(stats.videoCount)));
        document.querySelectorAll('#meta-views').forEach(e => e && (e.textContent = 'Views: ' + fmt(stats.viewCount)));
      }
      const featuredSlot = document.getElementById('featured-slot');
      if (featuredSlot) {
        const res = await fetchVideosWithDetails({ maxResults: 6 });
        if (res.items && res.items.length) renderFeatured(featuredSlot, res.items[0]);
        else featuredSlot.innerHTML = '<div class="error-msg">No featured video</div>';
      }
    } catch (err) {
      console.error("App.init error", err);
      // Show error in hero stats if present
      const statEls = document.querySelectorAll('#stat-subs,#stat-views,#stat-videos');
      statEls.forEach(el => el && (el.textContent = '—'));
    }
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
