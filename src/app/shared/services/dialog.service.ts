import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface DialogConfig {
  type: 'confirm' | 'alert' | 'prompt';
  variant: 'danger' | 'warning' | 'info' | 'succcess';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  private dialogSubject = new BehaviorSubject<DialogConfig | null>(null);

  dialog$ = this.dialogSubject.asObservable();

  confirm(options: Omit<DialogConfig, 'type'>): void {
    this.dialogSubject.next({ ...options, type: 'confirm' });
  }

  alert(options: Omit<DialogConfig, 'type' | 'onCancel'>): void {
    this.dialogSubject.next({ ...options, type: 'alert' });
  }

  prompt(options: Omit<DialogConfig, 'type'>): void {
    this.dialogSubject.next({ ...options, type: 'prompt' });
  }

  close(): void {
    this.dialogSubject.next(null);
  }
}
