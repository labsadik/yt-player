
// ================= SECURITY MODULE =================
const Security = {
  init() { this.devtoolsMonitor(); this.rateLimiter(); },
  devtoolsMonitor() {
    let warned = false;
    setInterval(() => {
      const threshold = 160;
      if ((window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) && !warned) {
        console.warn(`%c[🔐 SEC] Developer tools detected. Session activity logged.`, 'color:#ffaa00;font-weight:bold;');
        warned = true;
      } else if (warned && window.outerWidth - window.innerWidth <= threshold && window.outerHeight - window.innerHeight <= threshold) warned = false;
    }, 1500);
  },
  rateLimiter() {
    let last = 0;
    window.checkRateLimit = () => { const now = Date.now(); if (now - last < 700) return false; last = now; return true; };
  },
  sanitize(str) { if (typeof str !== 'string') return str; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; },
  safeUrl(url) { return url && /^https?:\/\//.test(url) ? url : ''; }
};
Security.init();

// ================= APP CONFIG =================
const API_URL = "http://localhost:5000/api/videos";
const AUTH_URL = "/auth/";

// ================= STATE =================
let state = { page:1, search:"", loading:false, hasMore:true, user:null, cachedVideos:[], isSearching:false, shuffleSeed:Date.now() };

// ================= AUTH =================
function initAuth() {
  const token = localStorage.getItem("token"), stored = localStorage.getItem("user");
  if (!token && !stored) state.user = {name:"Guest Viewer", email:"guest@unscplay.com"};
  if (token && stored) state.user = JSON.parse(stored);
  if (state.user) updateUIUser(state.user);
}
function updateUIUser(u) {
  const n = Security.sanitize(u.name || "User");
  document.getElementById("username").innerText = n;
  document.getElementById("avatar").innerText = n.charAt(0).toUpperCase();
  document.getElementById("avatar").className = "w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs sm:text-sm font-bold text-white";
  document.getElementById("profileName").innerText = n;
  document.getElementById("profileEmail").innerText = Security.sanitize(u.email || "");
  document.getElementById("profileAvatar").innerText = n.charAt(0).toUpperCase();
}
function goToAuth() { window.location.href = AUTH_URL; }
function logout() { localStorage.clear(); location.reload(); }
document.getElementById("userBox").addEventListener("click", () => state.user ? showPopup("profilePopup") : showPopup("loginPopup"));
function showPopup(id) { document.getElementById(id).classList.remove("hidden"); }
function closePopup(id) { document.getElementById(id).classList.add("hidden"); }

// ================= SEARCH POPUP =================
const searchTrigger = document.getElementById('searchTrigger'), searchPopup = document.getElementById('searchPopup'), searchClose = document.getElementById('searchClose'), searchInput = document.getElementById('searchInput'), searchDesktop = document.getElementById('searchDesktop');
function openSearchPopup() { searchPopup.classList.add('active'); setTimeout(() => searchInput?.focus(), 200); }
function closeSearchPopup() { searchPopup?.classList.remove('active'); searchInput?.blur(); }
searchTrigger?.addEventListener('click', openSearchPopup);
searchClose?.addEventListener('click', closeSearchPopup);
searchPopup?.addEventListener('click', e => { if(e.target === searchPopup) closeSearchPopup(); });

// ================= SMART SEARCH (Relevance + Fuzzy) =================
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
  const grid = document.getElementById("grid"); grid.innerHTML = "";
  if(!state.isSearching) { renderVideos(state.cachedVideos); document.getElementById("noSearchResults").classList.add("hidden"); return; }
  const ranked = state.cachedVideos.map(v=>({...v, score:calculateRelevance(v.title,query)})).filter(v=>v.score>0).sort((a,b)=>b.score-a.score);
  document.getElementById("noSearchResults").classList.toggle("hidden", ranked.length>0);
  renderVideos(ranked);
}
let debounceTimer;
function handleSearchInput(e) {
  const val = e.target.value; state.search = val;
  clearTimeout(debounceTimer); debounceTimer = setTimeout(() => applySmartSearch(val), 250);
}
searchInput?.addEventListener("input", handleSearchInput);
searchDesktop?.addEventListener("input", handleSearchInput);
searchInput?.addEventListener('keypress', e => { if(e.key==='Enter') applySmartSearch(e.target.value); });
searchDesktop?.addEventListener('keypress', e => { if(e.key==='Enter') applySmartSearch(e.target.value); });

// ================= DYNAMIC SHUFFLE (Fisher-Yates) =================
function shuffleArray(arr) {
  const a = [...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a;
}

// ================= VIDEO SYSTEM =================
function handleVideoClick(id) { window.location.href = `/feed/watch/?id=${id}`; }
async function fetchVideos(reset=false) {
  if(state.loading || !state.hasMore) return;
  if(!window.checkRateLimit()) return; // Security: Rate limit
  state.loading = true;
  if(reset) {
    state.page=1; state.hasMore=true; state.cachedVideos=[]; state.shuffleSeed=Date.now();
    document.getElementById("grid").innerHTML="";
    document.getElementById("endMsg").classList.add("hidden"); document.getElementById("errorMsg").classList.add("hidden");
    showSkeletons();
  } else document.getElementById("loader").classList.remove("hidden");
  try {
    const res = await fetch(`${API_URL}?page=${state.page}&limit=12&search=${encodeURIComponent(state.search)}`);
    if(!res.ok) throw new Error("Backend Error");
    const data = await res.json();
    let videos = Array.isArray(data) ? data : (data.videos || []);
    if(videos.length > 0) {
      if(state.page === 1) { videos = shuffleArray(videos); state.cachedVideos = [...videos]; removeSkeletons(); }
      else state.cachedVideos.push(...videos);
      state.isSearching ? applySmartSearch(state.search) : renderVideos(videos);
      state.page++;
    } else { state.hasMore=false; if(state.page===1) removeSkeletons(); document.getElementById("endMsg").classList.remove("hidden"); }
  } catch(err) { console.error(err); if(state.page===1){ removeSkeletons(); document.getElementById("errorMsg").classList.remove("hidden"); } }
  finally { state.loading=false; document.getElementById("loader").classList.add("hidden"); }
}
function renderVideos(videos) {
  const grid = document.getElementById("grid");
  videos.forEach(v => {
    const card = document.createElement("div");
    card.className = "group cursor-pointer flex flex-col gap-2 fade-in";
    card.onclick = () => handleVideoClick(v.id);
    const safeTitle = Security.sanitize(v.title), safeThumb = Security.safeUrl(v.thumbnail), safeDur = Security.sanitize(v.duration || "0:00");
    card.innerHTML = `<div class="relative aspect-video rounded-xl overflow-hidden bg-[#1f1f1f] ring-1 ring-[var(--glass-border)]"><img src="${safeThumb}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" alt="${safeTitle}"><div class="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm text-white text-xs px-1.5 py-0.5 rounded font-medium border border-white/10">${safeDur}</div></div><div class="mt-1 px-1"><h2 class="font-bold text-base sm:text-lg leading-tight line-clamp-2 text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">${safeTitle}</h2></div>`;
    grid.appendChild(card);
  });
}
function showSkeletons() {
  document.getElementById("grid").innerHTML = Array(9).fill(0).map(()=>`<div class="flex flex-col gap-2 animate-pulse"><div class="aspect-video rounded-xl skeleton"></div><div class="h-5 w-4/5 rounded skeleton mt-1"></div><div class="h-4 w-3/5 rounded skeleton"></div></div>`).join('');
}
function removeSkeletons() { if(document.querySelector('.skeleton')) document.getElementById("grid").innerHTML = ""; }

// Infinite Scroll
window.addEventListener("scroll", () => { if((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) fetchVideos(false); });

// Start
initAuth(); fetchVideos();
