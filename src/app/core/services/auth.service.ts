import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';

/**
 * 🔐 AuthService — Manages JWT lifecycle
 *
 * Responsibilities:
 * - Store/retrieve/remove JWT from localStorage
 * - Decode token payload without external libraries
 * - Check token expiration
 * - Emit authentication state changes reactively
 * - Handle logout with cleanup
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  // ═══════════════════════════════════════════
  // 📌 Private State
  // ═══════════════════════════════════════════
  private readonly TOKEN_KEY = 'access_token';

  /** BehaviorSubject emits current auth state immediately to new subscribers */
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(
    this.hasValidToken(),
  );

  /** Public observable — components subscribe to this */
  public isAuthenticated$: Observable<boolean> =
    this.isAuthenticatedSubject.asObservable();

  constructor(private router: Router) {}

  // ═══════════════════════════════════════════
  // 💾 Token CRUD Operations
  // ═══════════════════════════════════════════

  /** Store token and notify subscribers */
  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.isAuthenticatedSubject.next(true);
  }

  /** Retrieve raw JWT string */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /** Clear token, notify subscribers, redirect to login */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  // ═══════════════════════════════════════════
  // 🔍 Token Decoding & Validation
  // ═══════════════════════════════════════════

  /** Decode JWT payload (middle segment) without external deps */
  private decodeToken(): any {
    const token = this.getToken();
    if (!token) return null;

    try {
      // JWT format: header.payload.signature
      const payload = token.split('.')[1];
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('❌ Failed to decode JWT:', error);
      this.logout();
      return null;
    }
  }

  /** Extract numeric user ID from 'nameid' claim */
  getUserId(): number {
    const payload = this.decodeToken();
    return payload ? parseInt(payload.nameid, 10) : 0;
  }

  /** Extract username from 'unique_name' claim */
  getUsername(): string {
    const payload = this.decodeToken();
    return payload?.unique_name ?? '';
  }

  /** Check if token exists AND is not expired */
  hasValidToken(): boolean {
    const payload = this.decodeToken();
    if (!payload || !payload.exp) return false;

    // 'exp' is in seconds since epoch; Date.now() is in ms
    const expiresAt = payload.exp * 1000;
    return Date.now() < expiresAt;
  }
}
