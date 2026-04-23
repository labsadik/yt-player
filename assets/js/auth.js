
let isLogin = true;

// DOM Elements
const titleEl = document.getElementById("title");
const nameFieldEl = document.getElementById("nameField");
const nameInputEl = document.getElementById("name");
const submitBtnEl = document.getElementById("submitBtn");
const toggleTextEl = document.getElementById("toggleText");
const eyeIcon = document.getElementById("eyeIcon");
const passwordInput = document.getElementById("password");

function toggleMode() {
  isLogin = !isLogin;

  if (isLogin) {
    // Switch to Login
    titleEl.innerText = "Welcome Back";
    submitBtnEl.innerText = "Sign In";
    nameFieldEl.classList.add("hidden");
    toggleTextEl.innerText = "Don't have an account?";
    nameInputEl.removeAttribute('required');
  } else {
    // Switch to Register
    titleEl.innerText = "Create Account";
    submitBtnEl.innerText = "Register";
    nameFieldEl.classList.remove("hidden");
    toggleTextEl.innerText = "Already have an account?";
    nameInputEl.setAttribute('required', 'true');
  }
}

function togglePassword() {
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        eyeIcon.classList.remove("fa-eye");
        eyeIcon.classList.add("fa-eye-slash");
    } else {
        passwordInput.type = "password";
        eyeIcon.classList.remove("fa-eye-slash");
        eyeIcon.classList.add("fa-eye");
    }
}

async function handleAuth() {
  const name = nameInputEl.value.trim();
  const email = document.getElementById("email").value.trim();
  const password = passwordInput.value.trim();
  const btn = document.getElementById("submitBtn");

  // Validation
  if (!email || !password) {
    showToast("Please fill in all required fields", "error");
    return;
  }
  if (!isLogin && !name) {
    showToast("Name is required for registration", "error");
    return;
  }

  // UI Loading State
  const originalBtnText = btn.innerText;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
  btn.disabled = true;
  btn.classList.add("opacity-75", "cursor-not-allowed");

  const url = isLogin
    ? "http://localhost:5000/api/auth/login"
    : "http://localhost:5000/api/auth/register";

  const payload = isLogin
    ? { email, password }
    : { name, email, password };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.msg || "Authentication failed");
    }

    if (!isLogin) {
      showToast("Account created! Please sign in.", "success");
      toggleMode(); 
    } else {
      // LOGIN SUCCESS
      localStorage.setItem("token", data.token);
      
      if (data.user) {
        // Securely store user object
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      showToast("Login Successful! Redirecting...", "success");

      // Redirect Delay for UX
      setTimeout(() => {
          if (data.user && data.user.role === "admin") {
            window.location.href = "/feed/admin/";
          } else {
            window.location.href = "/";
          }
      }, 1000);
    }

  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  } finally {
    btn.innerText = originalBtnText;
    btn.disabled = false;
    btn.classList.remove("opacity-75", "cursor-not-allowed");
  }
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
