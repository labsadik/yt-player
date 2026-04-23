
// ================= SECURITY MODULE =================
const Security = {
  init() { this.devtoolsMonitor(); this.rateLimiter(); },
  devtoolsMonitor() {
    let warned = false;
    setInterval(() => {
      const t = 160;
      if ((window.outerWidth - window.innerWidth > t || window.outerHeight - window.innerHeight > t) && !warned) {
        console.warn(`%c[🔐 SEC] DevTools detected. Session logged.`, 'color:#ffaa00;font-weight:bold;');
        warned = true;
      } else if (warned && window.outerWidth - window.innerWidth <= t && window.outerHeight - window.innerHeight <= t) warned = false;
    }, 1500);
  },
  rateLimiter() {
    let last = 0;
    window.checkRateLimit = () => { const n = Date.now(); if (n - last < 600) return false; last = n; return true; };
  },
  sanitize(str) { if (typeof str !== 'string') return str; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; },
  safeUrl(u) { return u && /^https?:\/\//.test(u) ? u : ''; }
};
Security.init();

// ================= CONFIG =================
const API_URL = "http://localhost:5000/api/videos";

// ================= STATE =================
let state = {
  videos: [], filtered: [], currentIndex: 0, isPlaying: false,
  ytPlayer: null, updateInterval: null, duration: 0,
  currentVideoId: '', isPlayerReady: false,
  isSearching: false, cachedSearch: '', shuffleSeed: Date.now()
};

// ================= DOM =================
const els = {
  title: document.getElementById('video-title'), playlist: document.getElementById('playlist'),
  startOverlay: document.getElementById('start-overlay'), wrapper: document.getElementById('player-wrapper'),
  btnPlay: document.getElementById('btn-play'), iconPlay: document.getElementById('icon-play'),
  iconPause: document.getElementById('icon-pause'), progressBar: document.getElementById('progress-bar'),
  playedBar: document.getElementById('played-bar'), scrubber: document.getElementById('scrubber'),
  currTime: document.getElementById('current-time'), durTime: document.getElementById('duration'),
  btnFull: document.getElementById('btn-fullscreen'),
  shareModal: document.getElementById('share-modal'), shareModalContent: document.getElementById('share-modal-content'),
  shareUrlInput: document.getElementById('share-url'), playlistCount: document.getElementById('playlistCount'),
  searchInput: document.getElementById('searchInput'), searchDesktop: document.getElementById('searchDesktop'),
  searchPopup: document.getElementById('searchPopup'), searchTrigger: document.getElementById('searchTrigger'),
  searchClose: document.getElementById('searchClose'), searchSubmit: document.getElementById('searchSubmit')
};

// ================= SMART SEARCH =================
function levenshtein(a,b) {
  const m=a.length,n=b.length, dp=Array(m+1).fill(0).map(()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return dp[m][n];
}
function calculateRelevance(title, query) {
  if(!query) return 0;
  const t=title.toLowerCase().trim(), q=query.toLowerCase().trim(); let score=0;
  if(t===q) score+=100; else if(t.startsWith(q)) score+=85; else if(t.includes(q)) score+=65;
  const qWords=q.split(/\s+/).filter(w=>w.length>1), tWords=t.split(/\s+/); let matched=0;
  qWords.forEach(w=>{ if(t.includes(w)){ matched++; score+=20; } });
  if(matched===qWords.length && qWords.length>1) score+=30;
  qWords.forEach(w=>{ if(w.length>3 && score<40) for(let tw of tWords) if(levenshtein(tw,w)<=2){ score+=15; break; } });
  return score;
}
function applySmartSearch(query) {
  state.isSearching = query.trim().length > 0;
  state.cachedSearch = query;
  if(!state.isSearching) { state.filtered = [...state.videos]; renderPlaylist(); return; }
  state.filtered = state.videos.map(v=>({...v, score:calculateRelevance(v.title,query)})).filter(v=>v.score>0).sort((a,b)=>b.score-a.score);
  renderPlaylist();
}
let searchDebounce;
function handleSearchInput(e) {
  const val = e.target.value;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => applySmartSearch(val), 200);
}
els.searchInput?.addEventListener('input', handleSearchInput);
els.searchDesktop?.addEventListener('input', handleSearchInput);
els.searchInput?.addEventListener('keypress', e => { if(e.key==='Enter') applySmartSearch(e.target.value); });
els.searchDesktop?.addEventListener('keypress', e => { if(e.key==='Enter') applySmartSearch(e.target.value); });
els.searchSubmit?.addEventListener('click', () => applySmartSearch(els.searchInput?.value || ''));

// ================= SEARCH POPUP =================
function openSearchPopup() { els.searchPopup?.classList.add('active'); setTimeout(()=>els.searchInput?.focus(),150); }
function closeSearchPopup() { els.searchPopup?.classList.remove('active'); els.searchInput?.blur(); }
els.searchTrigger?.addEventListener('click', openSearchPopup);
els.searchClose?.addEventListener('click', closeSearchPopup);
els.searchPopup?.addEventListener('click', e => { if(e.target===els.searchPopup) closeSearchPopup(); });

// ================= DYNAMIC SHUFFLE =================
function shuffleArray(arr) {
  const a = [...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a;
}

// ================= INIT =================
async function init() {
  try {
    if(!window.checkRateLimit()) return;
    const res = await fetch(API_URL);
    if(!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    if(!Array.isArray(data.videos) || !data.videos.length) throw new Error('No videos');
    
    // Dynamic shuffle on every page load
    state.videos = shuffleArray(data.videos);
    state.filtered = [...state.videos];
    
    renderPlaylist();
    els.playlistCount.textContent = `${state.filtered.length} videos`;
    
    const params = new URLSearchParams(window.location.search);
    const vid = params.get('id');
    let idx = 0;
    if(vid) {
      const f = state.filtered.findIndex(v=>v.id===vid);
      if(f!==-1) idx = f;
    }
    loadVideoState(idx);
  } catch(err) {
    console.error('Init:', err);
    els.title.textContent = 'Error Loading';
    els.playlist.innerHTML = `<div class="p-4 text-center text-[var(--text-muted)] text-sm">${Security.sanitize(err.message)}</div>`;
  }
}

// ================= VIDEO LOADING =================
function loadVideoState(index) {
  state.currentIndex = index;
  const video = state.filtered[index];
  if(!video) return;
  
  state.currentVideoId = video.id;
  state.isPlayerReady = false;
  
  // Update URL without reload
  const url = `${window.location.pathname}?id=${video.id}`;
  window.history.replaceState({path:url}, '', url);
  
  // Clean title display - NO BOX/GRID
  els.title.textContent = Security.sanitize(video.title);
  document.title = `${Security.sanitize(video.title)} | Unscplay`;
  
  stopUpdateLoop();
  state.isPlaying = false;
  updatePlayIcon();
  
  els.startOverlay.classList.remove('ready');
  els.startOverlay.style.display = 'flex';
  els.startOverlay.style.backgroundImage = `url('${Security.safeUrl(video.thumbnail)}')`;
  
  highlightPlaylistItem(index);
  setupYouTubePlayer(video.id);
}

function setupYouTubePlayer(videoId) {
  if(!window.YT || !window.YT.Player) {
    loadYouTubeAPI(()=>setupYouTubePlayer(videoId));
    return;
  }
  if(state.ytPlayer) state.ytPlayer.destroy();
  
  let old = document.getElementById('yt-api-div');
  if(old) old.remove();
  let div = document.createElement('div');
  div.id = 'yt-api-div';
  els.wrapper.appendChild(div);
  
  state.ytPlayer = new YT.Player('yt-api-div', {
    height:'100%', width:'100%', videoId: videoId,
    playerVars: {autoplay:0, controls:0, rel:0, modestbranding:1, fs:0, iv_load_policy:3},
    events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
  });
}

function onPlayerReady(e) {
  state.duration = e.target.getDuration();
  els.durTime.textContent = formatTime(state.duration);
  e.target.setVolume(100);
  state.isPlayerReady = true;
  els.startOverlay.classList.add('ready');
}

function onPlayerStateChange(e) {
  if(e.data === YT.PlayerState.PLAYING) {
    state.isPlaying = true;
    els.startOverlay.style.display = 'none';
    els.wrapper.classList.remove('paused');
    if(state.ytPlayer) state.ytPlayer.setVolume(100);
    startUpdateLoop();
  } else {
    state.isPlaying = false;
    els.wrapper.classList.add('paused');
    stopUpdateLoop();
  }
  updatePlayIcon();
}

// ================= CONTROLS =================
els.startOverlay.addEventListener('click', () => {
  if(state.isPlayerReady && state.ytPlayer) { state.ytPlayer.playVideo(); state.ytPlayer.setVolume(100); }
});
els.btnPlay.addEventListener('click', togglePlay);
function togglePlay() {
  if(!state.ytPlayer) return;
  if(state.isPlaying) state.ytPlayer.pauseVideo();
  else {
    if(els.startOverlay.style.display !== 'none') els.startOverlay.click();
    else { state.ytPlayer.playVideo(); state.ytPlayer.setVolume(100); }
  }
}
function updatePlayIcon() {
  if(state.isPlaying) { els.iconPlay.classList.add('hidden'); els.iconPause.classList.remove('hidden'); }
  else { els.iconPlay.classList.remove('hidden'); els.iconPause.classList.add('hidden'); }
}

// ================= PROGRESS =================
function startUpdateLoop() {
  state.updateInterval = setInterval(() => {
    if(!state.ytPlayer || !state.isPlaying) return;
    const ct = state.ytPlayer.getCurrentTime(), dur = state.ytPlayer.getDuration();
    if(dur > 0) {
      const p = (ct/dur)*100;
      els.playedBar.style.width = `${p}%`;
      els.scrubber.style.left = `${p}%`;
      els.currTime.textContent = formatTime(ct);
    }
  }, 400);
}
function stopUpdateLoop() { clearInterval(state.updateInterval); }

let isDragging = false;
els.progressBar.addEventListener('mousedown', e => { isDragging=true; seek(e); });
els.progressBar.addEventListener('touchstart', e => { isDragging=true; seek(e.touches[0]); }, {passive:false});
document.addEventListener('mousemove', e => { if(isDragging) seek(e); });
document.addEventListener('touchmove', e => { if(isDragging) seek(e.touches[0]); }, {passive:false});
document.addEventListener('mouseup', () => isDragging=false);
document.addEventListener('touchend', () => isDragging=false);

function seek(e) {
  if(!state.ytPlayer || state.duration<=0) return;
  const r = els.progressBar.getBoundingClientRect();
  let x = e.clientX ?? e.pageX;
  let pos = (x - r.left) / r.width;
  pos = Math.max(0, Math.min(1, pos));
  const t = pos * state.duration;
  els.playedBar.style.width = `${pos*100}%`;
  els.scrubber.style.left = `${pos*100}%`;
  els.currTime.textContent = formatTime(t);
  state.ytPlayer.seekTo(t, true);
}

els.btnFull.addEventListener('click', () => {
  if(!document.fullscreenElement) els.wrapper.requestFullscreen().catch(console.error);
  else document.exitFullscreen();
});

// ================= PLAYLIST =================
function renderPlaylist() {
  els.playlist.innerHTML = '';
  if(!state.filtered.length) {
    els.playlist.innerHTML = `<div class="p-4 text-center text-[var(--text-muted)] text-sm">No results</div>`;
    els.playlistCount.textContent = '0 videos';
    return;
  }
  els.playlistCount.textContent = `${state.filtered.length} videos`;
  
  // Performance: Use document fragment for batch DOM insertion
  const frag = document.createDocumentFragment();
  state.filtered.forEach((vid, idx) => {
    const div = document.createElement('div');
    div.className = "flex gap-3 p-2.5 hover:bg-[var(--glass-border)] rounded-lg cursor-pointer transition-colors group border-b border-[var(--glass-border)] last:border-0 fade-in";
    div.style.animationDelay = `${idx*20}ms`;
    div.dataset.index = idx;
    div.onclick = () => { window.location.href = `${window.location.pathname}?id=${vid.id}`; };
    
    const safeThumb = Security.safeUrl(vid.thumbnail), safeTitle = Security.sanitize(vid.title), safeDur = Security.sanitize(vid.duration||'0:00');
    div.innerHTML = `
      <div class="relative w-36 h-20 flex-shrink-0 bg-gray-900 rounded-md overflow-hidden ring-1 ring-[var(--glass-border)]">
        <img src="${safeThumb}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" alt="${safeTitle}">
        <span class="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-white font-mono">${safeDur}</span>
      </div>
      <div class="flex flex-col justify-center min-w-0 pr-1">
        <h4 class="text-sm font-semibold text-[var(--text-main)] line-clamp-2 leading-snug group-hover:text-[var(--accent)] transition-colors">${safeTitle}</h4>
      </div>
    `;
    frag.appendChild(div);
  });
  els.playlist.appendChild(frag);
}

function highlightPlaylistItem(index) {
  const items = els.playlist.children;
  for(let item of items) {
    item.classList.remove('bg-[var(--glass-border)]', 'ring-1', 'ring-[var(--accent)]');
    if(parseInt(item.dataset.index) === index) {
      item.classList.add('bg-[var(--glass-border)]', 'ring-1', 'ring-[var(--accent)]');
      if(window.innerWidth > 1024) item.scrollIntoView({behavior:'smooth', block:'nearest'});
    }
  }
}

// ================= SKELETON LOADER FOR PLAYLIST =================
function showPlaylistSkeletons(count=6) {
  els.playlist.innerHTML = Array(count).fill(0).map(()=>`
    <div class="flex gap-3 p-2.5 border-b border-[var(--glass-border)] last:border-0">
      <div class="w-36 h-20 flex-shrink-0 rounded-md skeleton"></div>
      <div class="flex-1 flex flex-col justify-center gap-2">
        <div class="h-4 w-4/5 rounded skeleton"></div>
        <div class="h-3 w-3/5 rounded skeleton"></div>
      </div>
    </div>
  `).join('');
}

// ================= SHARE MODAL =================
function openShareModal() {
  els.shareUrlInput.value = window.location.href;
  els.shareModal.classList.remove('hidden');
  setTimeout(()=>{ els.shareModal.classList.remove('opacity-0'); els.shareModalContent.classList.remove('scale-95'); els.shareModalContent.classList.add('scale-100'); }, 10);
}
function closeShareModal() {
  els.shareModal.classList.add('opacity-0');
  els.shareModalContent.classList.remove('scale-100');
  els.shareModalContent.classList.add('scale-95');
  setTimeout(()=>els.shareModal.classList.add('hidden'), 300);
}
function copyShareLink() {
  els.shareUrlInput.select();
  navigator.clipboard.writeText(els.shareUrlInput.value).then(()=>{
    const btn = document.querySelector('#share-modal button.bg-\\[var\\(--accent\\)\\]');
    if(btn) { const orig = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied'; setTimeout(()=>btn.innerHTML=orig, 1800); }
  });
}
els.shareModal?.addEventListener('click', e => { if(e.target===els.shareModal) closeShareModal(); });

// ================= HELPERS =================
function formatTime(s) {
  if(!s || isNaN(s)) return "0:00";
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=Math.floor(s%60);
  const ss=sec<10?'0'+sec:sec, mm=m<10?'0'+m:m;
  return h>0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function loadYouTubeAPI(cb) {
  if(window.YT && window.YT.Player) { cb(); return; }
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  tag.onload = cb;
  document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);
}

// ================= PERFORMANCE: Lazy init on idle =================
if('requestIdleCallback' in window) {
  requestIdleCallback(init, {timeout: 2000});
} else {
  setTimeout(init, 100);
}

// ================= KEYBOARD SHORTCUTS =================
document.addEventListener('keydown', e => {
  if(e.target.tagName === 'INPUT') return;
  if(e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if(e.code === 'KeyF') { e.preventDefault(); els.btnFull.click(); }
  if(e.code === 'ArrowLeft' && state.ytPlayer) { e.preventDefault(); state.ytPlayer.seekTo(Math.max(0, state.ytPlayer.getCurrentTime()-5), true); }
  if(e.code === 'ArrowRight' && state.ytPlayer) { e.preventDefault(); state.ytPlayer.seekTo(state.ytPlayer.getCurrentTime()+5, true); }
});
