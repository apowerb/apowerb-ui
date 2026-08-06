/**
 * Auth storage utility for localStorage persistence.
 * Handles user session and profile data.
 */

const STORAGE_KEYS = {
  USER: "th2_auth_user",
  TOKEN: "th2_auth_token",
};

// Auth API calls use relative URLs to go through the Next.js proxy,
// avoiding CORS issues (browser → Next.js → backend).
const API_URL = "";

// Set to true to use mock API, false to use real backend
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true";

export const authStorage = {
  /**
   * Get stored user data
   */
  getUser() {
    if (typeof window === "undefined") return null;
    try {
      const userJson = localStorage.getItem(STORAGE_KEYS.USER);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error("[authStorage] Failed to get user:", error);
      return null;
    }
  },

  /**
   * Store user data
   */
  setUser(user) {
    if (typeof window === "undefined") return;
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch (error) {
      console.error("[authStorage] Failed to set user:", error);
    }
  },

  /**
   * Get stored auth token
   */
  getToken() {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error("[authStorage] Failed to get token:", error);
      return null;
    }
  },

  /**
   * Store auth token
   */
  setToken(token) {
    if (typeof window === "undefined") return;
    try {
      if (token) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
      }
    } catch (error) {
      console.error("[authStorage] Failed to set token:", error);
    }
  },

  /**
   * Clear all auth data (logout)
   */
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
  },
};

/**
 * Real API for authentication - connects to th2agent backend
 */
// Map a backend user payload (snake_case) to the frontend user shape (camelCase).
// onboarding_completed stays snake_case on purpose: HomeDashboard reads it as such.
function mapBackendUser(data) {
  return {
    id: data.user_id,
    email: data.email,
    username: data.username || data.email?.split("@")[0],
    firstName: data.first_name || data.full_name?.split(" ")[0] || "",
    lastName:
      data.last_name || data.full_name?.split(" ").slice(1).join(" ") || "",
    role: data.role?.toLowerCase() || "user",
    avatar: data.avatar_url || null,
    mfaEnabled: data.mfa_enabled || false,
    onboarding_completed: data.onboarding_completed === true,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export const realAuthApi = {
  /**
   * Login with email and password
   * Backend expects form-data with 'username' (email) and 'password'
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    // Backend uses OAuth2PasswordRequestForm which expects form-data
    const formData = new URLSearchParams();
    formData.append("username", email); // Backend uses 'username' for email
    formData.append("password", password);

    const response = await fetch(`${API_URL}/api/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
      credentials: "include", // For refresh token cookie
    });

    if (!response.ok) {
      if (response.status === 403) {
        const err = await response.json().catch(() => ({}));
        if (err.detail === "email_not_verified") {
          const e = new Error("Email not verified");
          e.code = "email_not_verified";
          e.email = email;
          throw e;
        }
      }
      if (response.status === 400 || response.status === 401) {
        throw new Error("Incorrect email or password");
      }
      if (response.status === 404) {
        throw new Error("User not found");
      }
      throw new Error("Server connection error");
    }

    const data = await response.json();

    // Check if MFA is required
    if (data.mfa_required) {
      return { mfaRequired: true, mfaToken: data.mfa_token };
    }

    const token = data.access_token;

    // Fetch user profile with the token
    const user = await this.getProfile(token);

    return { user, token };
  },

  /**
   * Login via OAuth provider (Google, GitHub, Microsoft)
   */
  async oauthLogin(provider, code, redirectUri) {
    const response = await fetch(`${API_URL}/api/users/${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error("Invalid or expired authorization code");
      }
      throw new Error("OAuth login error");
    }

    const data = await response.json();

    // Check if MFA is required
    if (data.mfa_required) {
      return { mfaRequired: true, mfaToken: data.mfa_token };
    }

    const token = data.access_token;

    const user = {
      id: data.user?.id || data.user?.user_id,
      email: data.user?.email,
      username: data.user?.username || data.user?.email?.split("@")[0],
      firstName:
        data.user?.full_name?.split(" ")[0] || data.user?.first_name || "",
      lastName:
        data.user?.full_name?.split(" ").slice(1).join(" ") ||
        data.user?.last_name ||
        "",
      avatar: data.user?.avatar_url || null,
      role: data.user?.role?.toLowerCase() || "user",
      onboarding_completed: data.user?.onboarding_completed === true,
    };

    return { user, token };
  },

  /**
   * Get current user profile
   */
  async getProfile(token) {
    const response = await fetch(`${API_URL}/api/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Unable to retrieve profile");
    }

    const data = await response.json();

    // Map backend user to frontend format
    return mapBackendUser(data);
  },

  /**
   * Register new user
   */
  async register({ email, password, firstName, lastName }) {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const response = await fetch(`${API_URL}/api/users/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        first_name: firstName || email.split("@")[0],
        last_name: lastName || "",
      }),
    });

    if (!response.ok) {
      if (response.status === 400) {
        const error = await response.json().catch(() => ({}));
        if (error.detail?.includes("email")) {
          throw new Error("This email is already in use");
        }
        throw new Error(error.detail || "Invalid data");
      }
      throw new Error("Error creating account");
    }

    // After registration, try to auto-login. When the email-verification
    // gate is active the backend returns 403 -> surface a verify-email state.
    try {
      return await this.login(email, password);
    } catch (e) {
      if (e.code === "email_not_verified") {
        return { needsVerification: true, email };
      }
      throw e;
    }
  },

  /**
   * Confirm an email-verification token.
   */
  async verifyEmail(token) {
    const response = await fetch(`${API_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      throw new Error("Invalid or expired verification link");
    }
    return true;
  },

  /**
   * Re-send the verification email (always resolves; anti-enumeration).
   */
  async resendVerification(email) {
    try {
      await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch (_) {}
  },

  /**
   * Reset the password using a token from the reset email.
   */
  async resetPassword(token, newPassword) {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!response.ok) {
      throw new Error("Lien de réinitialisation invalide ou expiré");
    }
    return true;
  },

  /**
   * Refresh access token using refresh token cookie
   */
  async refreshToken() {
    const response = await fetch(`${API_URL}/api/auth/refresh-token`, {
      method: "POST",
      credentials: "include", // Send refresh token cookie
    });

    if (!response.ok) {
      throw new Error("Session expired, please sign in again");
    }

    const data = await response.json();
    return data.access_token;
  },

  /**
   * Update user profile
   */
  async updateProfile(userId, updates, token) {
    // Only send fields that were actually provided, so a partial update
    // (e.g. just onboarding_completed) never wipes first/last name.
    const payload = {};
    if (updates.firstName !== undefined) payload.first_name = updates.firstName;
    if (updates.lastName !== undefined) payload.last_name = updates.lastName;
    if (updates.username !== undefined) payload.username = updates.username;
    if (updates.onboarding_completed !== undefined)
      payload.onboarding_completed = updates.onboarding_completed;

    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Error updating profile");
    }

    const data = await response.json();
    // Return the normalized frontend shape so AuthContext never merges raw
    // snake_case backend keys into the user object.
    return mapBackendUser(data);
  },

  /**
   * MFA: Start setup — returns secret + QR code
   */
  async mfaSetup(token) {
    const response = await fetch(`${API_URL}/api/auth/mfa/setup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error("Failed to setup MFA");
    return response.json();
  },

  /**
   * MFA: Enable — verify code and activate MFA
   * The secret is stored server-side during /mfa/setup, so only the code is needed.
   */
  async mfaEnable(code, token) {
    const response = await fetch(`${API_URL}/api/auth/mfa/enable`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Invalid verification code");
    }
    return response.json();
  },

  /**
   * MFA: Disable — verify code and deactivate MFA
   */
  async mfaDisable(code, token) {
    const response = await fetch(`${API_URL}/api/auth/mfa/disable`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Invalid verification code");
    }
    return response.json();
  },

  /**
   * MFA: Verify — validate TOTP code during login (no auth required)
   */
  async mfaVerify(mfaToken, code) {
    const response = await fetch(`${API_URL}/api/auth/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfa_token: mfaToken, code }),
      credentials: "include",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Invalid verification code");
    }
    return response.json();
  },

  /**
   * MFA: Get backup codes
   */
  async mfaBackupCodes(token) {
    const response = await fetch(`${API_URL}/api/auth/mfa/backup-codes`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error("Failed to get backup codes");
    return response.json();
  },

  /**
   * Logout - clear cookies
   */
  async logout() {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort — local state will be cleared anyway
    }
    return true;
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    if (!email) {
      throw new Error("Email is required");
    }

    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      // Don't reveal if email exists or not for security
      // Just return success in all cases
    }

    return true;
  },
};

/**
 * Mock API for authentication (for development/testing)
 */
/**
 * Shape check for an email address, without a backtracking regex.
 *
 * The previous `/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/` is polynomial: the two
 * greedy classes around the dot make the engine retry every split of the
 * domain when there is no dot to find. This only guards the mock backend,
 * but the module ships in the published SDK bundle, so the pattern leaves
 * with it.
 *
 * Same verdict as before: one `@`, non-empty on both sides, no whitespace,
 * and a dot inside the domain with something on either side.
 */
function looksLikeEmail(value) {
  const parts = value.split("@");
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (/\s/.test(value)) return false;

  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

export const mockAuthApi = {
  /**
   * Demo credentials for testing
   */
  DEMO_USERS: {
    "admin@th2.ai": {
      password: "admin123",
      user: {
        id: "user_admin",
        email: "admin@th2.ai",
        username: "admin",
        firstName: "Admin",
        lastName: "TH2",
        avatar: null,
        role: "admin",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    },
    "demo@th2.ai": {
      password: "demo123",
      user: {
        id: "user_demo",
        email: "demo@th2.ai",
        username: "demo",
        firstName: "Demo",
        lastName: "User",
        avatar: null,
        role: "user",
        createdAt: "2024-01-15T00:00:00.000Z",
      },
    },
  },

  /**
   * Simulate login
   */
  async login(email, password) {
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const demoUser = this.DEMO_USERS[email.toLowerCase()];
    if (demoUser) {
      if (demoUser.password !== password) {
        throw new Error("Incorrect password");
      }
      const token = `mock_token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return { user: { ...demoUser.user }, token };
    }

    if (password.length < 6) {
      throw new Error("Incorrect password");
    }

    const user = {
      id: `user_${Date.now()}`,
      email,
      username: email.split("@")[0],
      firstName: "",
      lastName: "",
      avatar: null,
      role: "user",
      createdAt: new Date().toISOString(),
    };

    const token = `mock_token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { user, token };
  },

  /**
   * Simulate OAuth login
   */
  async oauthLogin(provider, code, redirectUri) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const user = {
      id: `user_oauth_${Date.now()}`,
      email: `${provider}user@example.com`,
      username: `${provider}user`,
      firstName: "OAuth",
      lastName: "User",
      avatar: null,
      role: "user",
      createdAt: new Date().toISOString(),
    };
    const token = `mock_oauth_token_${Date.now()}`;
    return { user, token };
  },

  /**
   * Simulate registration
   */
  async register({ email, password, username, firstName, lastName }) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!email || !password) {
      throw new Error("All required fields must be filled");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    if (!looksLikeEmail(email)) {
      throw new Error("Invalid email format");
    }

    const user = {
      id: `user_${Date.now()}`,
      email,
      username: username || email.split("@")[0],
      firstName: firstName || "",
      lastName: lastName || "",
      avatar: null,
      role: "user",
      createdAt: new Date().toISOString(),
    };

    const token = `mock_token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { user, token };
  },

  async verifyEmail() {
    return true;
  },

  async resetPassword() {
    return true;
  },

  async resendVerification() {
    return;
  },

  /**
   * Simulate MFA setup
   */
  async mfaSetup() {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      secret: "JBSWY3DPEHPK3PXP",
      qr_code_uri:
        "otpauth://totp/TH2:demo@th2.ai?secret=JBSWY3DPEHPK3PXP&issuer=TH2",
      qr_code_base64:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    };
  },

  /**
   * Simulate MFA enable
   */
  async mfaEnable(code) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (code.length !== 6) throw new Error("Invalid verification code");
    return {
      status: "ok",
      message: "MFA enabled",
      backup_codes: [
        "a1b2c3d4",
        "e5f6g7h8",
        "i9j0k1l2",
        "m3n4o5p6",
        "q7r8s9t0",
        "u1v2w3x4",
        "y5z6a7b8",
        "c9d0e1f2",
      ],
    };
  },

  /**
   * Simulate MFA disable
   */
  async mfaDisable(code) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (code.length !== 6) throw new Error("Invalid verification code");
    return { status: "ok", message: "MFA disabled" };
  },

  /**
   * Simulate MFA verify
   */
  async mfaVerify(mfaToken, code) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (code.length !== 6) throw new Error("Invalid verification code");
    return {
      access_token: `mock_token_${Date.now()}`,
      token_type: "bearer",
    };
  },

  /**
   * Simulate MFA backup codes
   */
  async mfaBackupCodes() {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      backup_codes: [
        "a1b2c3d4",
        "e5f6g7h8",
        "i9j0k1l2",
        "m3n4o5p6",
        "q7r8s9t0",
        "u1v2w3x4",
        "y5z6a7b8",
        "c9d0e1f2",
      ],
    };
  },

  /**
   * Simulate profile update
   */
  async updateProfile(userId, updates) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      ...updates,
      id: userId,
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Simulate avatar upload
   */
  async uploadAvatar(userId, file) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Error loading image"));
      reader.readAsDataURL(file);
    });
  },

  /**
   * Simulate logout
   */
  async logout() {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return true;
  },

  /**
   * Simulate password reset request
   */
  async requestPasswordReset(email) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!email) {
      throw new Error("Email is required");
    }

    // In mock mode, always return success (simulates email sent)
    // In real implementation, backend would send email
    console.log(`[Mock] Password reset email would be sent to: ${email}`);
    return true;
  },
};

/**
 * Export the appropriate API based on configuration
 * Set NEXT_PUBLIC_USE_MOCK_AUTH=true in .env for mock API
 */
export const authApi = USE_MOCK_API ? mockAuthApi : realAuthApi;
