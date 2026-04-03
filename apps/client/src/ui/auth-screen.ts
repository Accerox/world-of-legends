/**
 * Auth Screen — Login / Register UI
 *
 * Dark themed screen with WOL logo, two tabs (Login / Register).
 * Returns a promise that resolves with { token, accountId } on successful auth.
 * Stores JWT in localStorage for auto-login on refresh.
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://wol-api.raregames.io'
const TOKEN_KEY = 'wol_token'
const ACCOUNT_KEY = 'wol_account_id'

export interface AuthResult {
  token: string
  accountId: string
}

/**
 * Check localStorage for existing token and validate it.
 * Returns null if no valid token found.
 */
async function tryAutoLogin(): Promise<AuthResult | null> {
  const token = localStorage.getItem(TOKEN_KEY)
  const accountId = localStorage.getItem(ACCOUNT_KEY)
  if (!token || !accountId) return null

  try {
    // Validate token by fetching characters (lightweight check)
    const res = await fetch(`${API_URL}/characters`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      return { token, accountId }
    }
    // Token expired or invalid — clear it
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ACCOUNT_KEY)
    return null
  } catch {
    // Network error — let user try manually
    return null
  }
}

/**
 * Show the auth screen and wait for successful login/register.
 */
export function showAuthScreen(): Promise<AuthResult> {
  return new Promise(async (resolve) => {
    // Try auto-login first
    const autoResult = await tryAutoLogin()
    if (autoResult) {
      resolve(autoResult)
      return
    }

    const screen = document.getElementById('auth-screen')!
    screen.style.display = 'flex'

    // ─── State ────────────────────────────────────────────────────────────────
    let activeTab: 'login' | 'register' = 'login'

    // ─── Build UI ─────────────────────────────────────────────────────────────
    screen.innerHTML = `
      <div class="auth-box">
        <h1 class="auth-title">World of Legends</h1>
        <p class="auth-subtitle">A browser MMORPG adventure</p>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Login</button>
          <button class="auth-tab" data-tab="register">Register</button>
        </div>

        <!-- Login Form -->
        <div class="auth-form" id="login-form">
          <input type="email" id="login-email" placeholder="Email address" autocomplete="email" />
          <input type="password" id="login-password" placeholder="Password" autocomplete="current-password" />
          <button class="auth-submit" id="login-btn">Login</button>
          <p class="auth-error" id="login-error"></p>
          <p class="auth-switch">Don't have an account? <a href="#" data-switch="register">Register</a></p>
        </div>

        <!-- Register Form -->
        <div class="auth-form" id="register-form" style="display:none">
          <input type="email" id="register-email" placeholder="Email address" autocomplete="email" />
          <input type="password" id="register-password" placeholder="Password" autocomplete="new-password" />
          <input type="password" id="register-confirm" placeholder="Confirm password" autocomplete="new-password" />
          <button class="auth-submit" id="register-btn">Create Account</button>
          <p class="auth-error" id="register-error"></p>
          <p class="auth-switch">Already have an account? <a href="#" data-switch="login">Login</a></p>
        </div>
      </div>
    `

    // ─── Elements ─────────────────────────────────────────────────────────────
    const tabs = screen.querySelectorAll<HTMLButtonElement>('.auth-tab')
    const loginForm = document.getElementById('login-form')!
    const registerForm = document.getElementById('register-form')!
    const loginEmail = document.getElementById('login-email') as HTMLInputElement
    const loginPassword = document.getElementById('login-password') as HTMLInputElement
    const loginBtn = document.getElementById('login-btn') as HTMLButtonElement
    const loginError = document.getElementById('login-error')!
    const registerEmail = document.getElementById('register-email') as HTMLInputElement
    const registerPassword = document.getElementById('register-password') as HTMLInputElement
    const registerConfirm = document.getElementById('register-confirm') as HTMLInputElement
    const registerBtn = document.getElementById('register-btn') as HTMLButtonElement
    const registerError = document.getElementById('register-error')!
    const switchLinks = screen.querySelectorAll<HTMLAnchorElement>('[data-switch]')

    // ─── Tab switching ────────────────────────────────────────────────────────
    function switchTab(tab: 'login' | 'register') {
      activeTab = tab
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tab))
      loginForm.style.display = tab === 'login' ? 'block' : 'none'
      registerForm.style.display = tab === 'register' ? 'block' : 'none'
      loginError.textContent = ''
      registerError.textContent = ''
      if (tab === 'login') {
        setTimeout(() => loginEmail.focus(), 50)
      } else {
        setTimeout(() => registerEmail.focus(), 50)
      }
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab as 'login' | 'register'))
    })

    switchLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        switchTab(link.dataset.switch as 'login' | 'register')
      })
    })

    // ─── Login handler ────────────────────────────────────────────────────────
    async function handleLogin() {
      const email = loginEmail.value.trim()
      const password = loginPassword.value

      if (!email || !password) {
        loginError.textContent = 'Please fill in all fields'
        return
      }

      loginBtn.disabled = true
      loginBtn.textContent = 'Logging in...'
      loginError.textContent = ''

      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const data = await res.json()

        if (!res.ok) {
          loginError.textContent = data.error || 'Login failed'
          loginBtn.disabled = false
          loginBtn.textContent = 'Login'
          return
        }

        // Store token
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(ACCOUNT_KEY, data.accountId)

        screen.style.display = 'none'
        resolve({ token: data.token, accountId: data.accountId })
      } catch (err) {
        loginError.textContent = 'Network error — please try again'
        loginBtn.disabled = false
        loginBtn.textContent = 'Login'
      }
    }

    loginBtn.addEventListener('click', handleLogin)
    loginPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin()
    })

    // ─── Register handler ─────────────────────────────────────────────────────
    async function handleRegister() {
      const email = registerEmail.value.trim()
      const password = registerPassword.value
      const confirm = registerConfirm.value

      if (!email || !password || !confirm) {
        registerError.textContent = 'Please fill in all fields'
        return
      }

      if (password.length < 6) {
        registerError.textContent = 'Password must be at least 6 characters'
        return
      }

      if (password !== confirm) {
        registerError.textContent = 'Passwords do not match'
        return
      }

      registerBtn.disabled = true
      registerBtn.textContent = 'Creating account...'
      registerError.textContent = ''

      try {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const data = await res.json()

        if (!res.ok) {
          registerError.textContent = data.error || 'Registration failed'
          registerBtn.disabled = false
          registerBtn.textContent = 'Create Account'
          return
        }

        // Store token
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(ACCOUNT_KEY, data.accountId)

        screen.style.display = 'none'
        resolve({ token: data.token, accountId: data.accountId })
      } catch (err) {
        registerError.textContent = 'Network error — please try again'
        registerBtn.disabled = false
        registerBtn.textContent = 'Create Account'
      }
    }

    registerBtn.addEventListener('click', handleRegister)
    registerConfirm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleRegister()
    })

    // Auto-focus
    setTimeout(() => loginEmail.focus(), 100)
  })
}

/**
 * Clear stored auth data (logout).
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ACCOUNT_KEY)
  window.location.reload()
}
