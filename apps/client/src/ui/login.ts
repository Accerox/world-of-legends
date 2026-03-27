/**
 * Login screen logic.
 * Returns a promise that resolves with the username when the player clicks "Enter World".
 */
export function showLoginScreen(): Promise<string> {
  return new Promise((resolve) => {
    const loginScreen = document.getElementById('login-screen')!
    const usernameInput = document.getElementById('username-input') as HTMLInputElement
    const joinBtn = document.getElementById('join-btn') as HTMLButtonElement
    const errorEl = document.getElementById('login-error')!

    loginScreen.style.display = 'flex'

    const submit = () => {
      const username = usernameInput.value.trim()

      if (!username || username.length < 2) {
        errorEl.textContent = 'Name must be at least 2 characters'
        return
      }

      if (username.length > 16) {
        errorEl.textContent = 'Name must be 16 characters or less'
        return
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errorEl.textContent = 'Only letters, numbers, and underscores allowed'
        return
      }

      errorEl.textContent = ''
      joinBtn.disabled = true
      joinBtn.textContent = 'Connecting...'

      resolve(username)
    }

    joinBtn.addEventListener('click', submit)
    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit()
    })

    // Auto-focus the input
    setTimeout(() => usernameInput.focus(), 100)
  })
}

/**
 * Hide the login screen after successful join.
 */
export function hideLoginScreen(): void {
  const loginScreen = document.getElementById('login-screen')!
  loginScreen.style.display = 'none'
}

/**
 * Show an error on the login screen and re-enable the button.
 */
export function showLoginError(message: string): void {
  const errorEl = document.getElementById('login-error')!
  const joinBtn = document.getElementById('join-btn') as HTMLButtonElement

  errorEl.textContent = message
  joinBtn.disabled = false
  joinBtn.textContent = 'Enter World'
}
