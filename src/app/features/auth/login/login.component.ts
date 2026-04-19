import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  HttpClient,
  HttpClientModule,
  HttpErrorResponse,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { LoginService } from './login.service';

/**
 * 🖥️ LoginComponent
 *
 * Handles user authentication with:
 * - Reactive form validation
 * - Loading state management
 * - Server error display
 * - Auto-redirect on success
 * - Automatic unsubscription on destroy
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit, OnDestroy {
  // ═══════════════════════════════════════════
  // 📌 Properties
  // ═══════════════════════════════════════════
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';

  /** Destroy notifier for automatic unsubscription */
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private loginService: LoginService,
  ) {}

  // ═══════════════════════════════════════════
  // 🔄 Lifecycle Hooks
  // ═══════════════════════════════════════════

  ngOnInit(): void {
    // Redirect if already logged in
    if (this.auth.hasValidToken()) {
      this.router.navigate(['/chat']);
      return;
    }

    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════
  // 🎯 Actions
  // ═══════════════════════════════════════════

  login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const credentials = this.loginForm.getRawValue();
    console.log(credentials);

    this.loginService
      .login(credentials)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoading = false)),
      )
      .subscribe({
        next: (response: { token: string }) => {
          this.auth.setToken(response.token);
          this.router.navigate(['/chat']);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage =
            err.status === 401
              ? 'Invalid username or password'
              : 'Server error. Please try again later.';
        },
      });
  }

  // ═══════════════════════════════════════════
  // 🔧 Template Helpers
  // ═══════════════════════════════════════════

  get f() {
    return this.loginForm.controls;
  }
}
