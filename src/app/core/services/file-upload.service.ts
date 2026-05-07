import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { UploadResponse } from '../models/chat.models';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private readonly maxBytes = 10 * 1024 * 1024;

  private readonly allowedTypes = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]);

  constructor(private http: HttpClient) {}

  validate(file: File): string | null {
    if (file.size > this.maxBytes)
      return `File too large — max ${this.formatSize(this.maxBytes)}`;

    if (!this.allowedTypes.has(file.type)) {
      return `"${file.type}" files are not supported`;
    }

    return null;
  }

  upload(
    file: File,
    cancelSignal?: Subject<void>,
  ): Observable<{ progress: number; response?: UploadResponse }> {
    return new Observable((observer) => {
      const form = new FormData();
      form.append('file', file, file.name);

      const req = new HttpRequest(
        'POST',
        `${environment.apiUrl}/files/upload`,
        form,
        { reportProgress: true, responseType: 'json' },
      );

      const sub = this.http.request(req).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = event.total
              ? Math.round((100 * event.loaded) / event.total)
              : 0;
            observer.next({ progress });
          } else if (event.type === HttpEventType.Response) {
            observer.next({
              progress: 100,
              response: event.body as UploadResponse,
            });
            observer.complete();
          }
        },
        error: (err) => observer.error(err),
      });

      if (cancelSignal) {
        const cs = cancelSignal.subscribe(() => {
          sub.unsubscribe();
          observer.error(new Error('Upload cancelled'));
        });
        return () => cs.unsubscribe();
      }

      return () => sub.unsubscribe();
    });
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }
  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
  // Returns a Lucide icon name for each file type
  getFileIcon(mimeType: string): string {
    if (this.isImage(mimeType)) return 'image';
    if (mimeType === 'application/pdf') return 'file-text';
    if (mimeType.includes('word')) return 'file-text';
    if (mimeType.includes('excel') || mimeType.includes('sheet'))
      return 'table';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
    return 'file';
  }
}
