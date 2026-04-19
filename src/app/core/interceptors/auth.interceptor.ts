import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';

/**
 * 🛡️ AuthInterceptor
 *
 * Middleware that:
 * 1. Clones every outgoing HTTP request
 * 2. Attaches the JWT Bearer token if available
 * 3. Catches 401 responses and triggers auto-logout
 *
 * ⚡ Requests are IMMUTABLE in Angular — you must clone()
 *    to modify headers.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    debugger;
    // ── 1. Attach JWT token if it exists ──
    const token = this.auth.getToken();

    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
    console.log(request);

    // ── 2. Forward request & handle errors ──
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // 401 = token expired or invalid → force logout
        if (error.status === 401) {
          console.warn('⚠️ 401 received — logging out');
          this.auth.logout();
        }

        // Re-throw so individual subscribers can also handle
        return throwError(() => error);
      }),
    );
  }
}
