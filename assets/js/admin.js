
const API = "http://localhost:5000/api/videos";

// ================= THEME LOGIC =================
function setTheme(themeName) {
  document.body.classList.remove('theme-ny-dark', 'theme-white');
  if (themeName === 'ny-dark') {
    document.body.classList.add('theme-ny-dark');
    localStorage.setItem('theme', 'ny-dark');
  } else if (themeName === 'white') {
    document.body.classList.add('theme-white');
    localStorage.setItem('theme', 'white');
  } else {
    localStorage.removeItem('theme');
  }
}
(function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) setTheme(savedTheme);
})();

// ================= SECURITY & AUTH =================
function checkAuth() {
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");

  if (!token || !userStr) {
    window.location.href = "/auth/";
    return null;
  }

  try {
    const user = JSON.parse(userStr);
    
    // STRICT ROLE CHECK
    if (user.role !== 'admin') {
      showToast("⛔ Access Denied: 404", "error");
      setTimeout(() => window.location.href = "/auth/", 1500);
      return null;
    }

    // Securely Update UI (Prevent XSS)
    document.getElementById("adminName").textContent = user.name;
    document.getElementById("adminEmail").textContent = user.email;
    document.getElementById("adminAvatar").textContent = user.name.charAt(0).toUpperCase();
    
    return token;
  } catch (e) {
    console.error("Auth Parse Error", e);
    logout();
    return null;
  }
}

const token = checkAuth();

// ================= DATA LOADING =================
async function loadVideos() {
  try {
    const res = await fetch(API, {
        headers: { "Authorization": token } // Secure header
    });
    
    if(res.status === 401) { logout(); return; } // Auto logout if token invalid

    const data = await res.json();
    const videos = Array.isArray(data) ? data : (data.videos || []);
    
    document.getElementById("totalCount").innerText = `${videos.length} Videos`;
    renderList(videos);
  } catch (err) {
    console.error(err);
    document.getElementById("videosList").innerHTML = `<div class="text-red-500 text-center py-4">Error connecting to backend</div>`;
  }
}

function renderList(videos) {
  const container = document.getElementById("videosList");
  container.innerHTML = "";

  if(videos.length === 0) {
    container.innerHTML = `<div class="text-[var(--text-muted)] text-center py-10">No videos found. Add one on the left.</div>`;
    return;
  }

  videos.forEach(v => {
    const div = document.createElement("div");
    div.className = "flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--glass-border)] hover:border-[var(--accent)] transition group";
    
    // Using DOM creation for security (prevents XSS in titles)
    const thumbDiv = document.createElement("div");
    thumbDiv.className = "relative w-full sm:w-40 aspect-video bg-black rounded overflow-hidden flex-shrink-0";
    thumbDiv.innerHTML = `
        <img src="${v.thumbnail}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition">
        <span class="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-white font-mono">${v.duration}</span>
    `;

    const infoDiv = document.createElement("div");
    infoDiv.className = "flex-1 min-w-0 w-full";
    
    const titleEl = document.createElement("h3");
    titleEl.className = "font-bold text-sm sm:text-base truncate text-[var(--text-main)] group-hover:text-[var(--accent)] mb-1";
    titleEl.textContent = v.title; // SECURE TEXT INSERTION
    
    const metaEl = document.createElement("div");
    metaEl.className = "flex flex-wrap gap-3 text-xs text-[var(--text-muted)] font-mono";
    metaEl.innerHTML = `<span><i class="fa-brands fa-youtube mr-1"></i>${v.id}</span>`;

    infoDiv.appendChild(titleEl);
    infoDiv.appendChild(metaEl);

    const actionDiv = document.createElement("div");
    actionDiv.className = "flex gap-2 w-full sm:w-auto mt-2 sm:mt-0";
    actionDiv.innerHTML = `
        <button class="flex-1 sm:flex-none bg-[var(--input-bg)] hover:bg-blue-600 hover:text-white text-blue-500 px-3 py-1.5 rounded text-sm transition border border-[var(--glass-border)]">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
        <button class="flex-1 sm:flex-none bg-[var(--input-bg)] hover:bg-red-600 hover:text-white text-red-500 px-3 py-1.5 rounded text-sm transition border border-[var(--glass-border)]">
          <i class="fa-solid fa-trash"></i>
        </button>
    `;
    
    // Event Listeners
    actionDiv.children[0].onclick = () => openEdit(v);
    actionDiv.children[1].onclick = () => deleteVideo(v._id);

    div.appendChild(thumbDiv);
    div.appendChild(infoDiv);
    div.appendChild(actionDiv);
    
    container.appendChild(div);
  });
}

// ================= CRUD OPERATIONS =================
async function addVideo() {
  const id = document.getElementById("videoId").value.trim();
  const title = document.getElementById("title").value.trim();
  const duration = document.getElementById("duration").value.trim();

  if(!id || !title) return showToast("ID and Title are required", "error");

  const btn = document.querySelector("button[onclick='addVideo()']");
  const originalText = btn.innerText;
  btn.innerText = "Publishing...";
  btn.disabled = true;

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({ id, title, duration })
    });

    if(!res.ok) throw new Error("Failed");

    showToast("Video Published Successfully", "success");
    document.getElementById("videoId").value = "";
    document.getElementById("title").value = "";
    document.getElementById("duration").value = "";
    loadVideos(); 

  } catch(err) {
    showToast("Error adding video", "error");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

async function deleteVideo(dbId) {
  if(!confirm("Are you sure? This cannot be undone.")) return;

  try {
    const res = await fetch(`${API}/${dbId}`, {
      method: "DELETE",
      headers: { "Authorization": token }
    });
    
    if(res.ok) {
        showToast("Video Deleted", "success");
        loadVideos();
    } else {
        throw new Error("Delete failed");
    }
  } catch(err) {
    showToast("Delete failed", "error");
  }
}

// ================= EDIT MODAL =================
function openEdit(videoObj) {
  document.getElementById("editDbId").value = videoObj._id;
  document.getElementById("editYtId").value = videoObj.id;
  document.getElementById("editTitle").value = videoObj.title;
  document.getElementById("editDuration").value = videoObj.duration;
  
  const modal = document.getElementById("editModal");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    document.getElementById("editBox").classList.remove("scale-95");
    document.getElementById("editBox").classList.add("scale-100");
  }, 10);
}

function closeModal() {
  const modal = document.getElementById("editModal");
  modal.classList.add("opacity-0");
  document.getElementById("editBox").classList.add("scale-95");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

async function saveEdit() {
  const dbId = document.getElementById("editDbId").value;
  const id = document.getElementById("editYtId").value;
  const title = document.getElementById("editTitle").value;
  const duration = document.getElementById("editDuration").value;

  try {
    const res = await fetch(`${API}/${dbId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({ id, title, duration })
    });
    
    if(res.ok) {
        closeModal();
        showToast("Video Updated", "success");
        loadVideos();
    } else {
        throw new Error("Update failed");
    }
  } catch(err) {
    showToast("Update failed", "error");
  }
}

// ================= UTILS =================
function logout() {
  localStorage.clear();
  window.location.href = "auth.html";
}

function showToast(msg, type) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";
    
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle text-green-500"></i>' : '<i class="fa-solid fa-circle-exclamation text-red-500"></i>';
    
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// INIT
loadVideos();
