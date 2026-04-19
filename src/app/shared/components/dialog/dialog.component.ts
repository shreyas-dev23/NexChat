import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  CommonModule,
  NgIf,
} from '../../../../../node_modules/@angular/common/index';
import { Observable } from 'rxjs';
import { DialogConfig, DialogService } from '../../services/dialog.service';
import { SharedModule } from '../../shared.module';
import { IconsModule } from '../../icons.module';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css'],
})
export class DialogComponent implements OnInit {
  dialog$!: Observable<DialogConfig | null>;
  promptValue = '';

  @ViewChild('promptInput') promptInput!: ElementRef;

  constructor(private dialogService: DialogService) {
    this.dialog$ = this.dialogService.dialog$;
  }

  ngOnInit() {}

  getIcon(variant: string) {
    const icons: Record<string, string> = {
      danger: 'alert-triangle',
      warning: 'alert-circle',
      info: 'info',
      success: 'check-circle',
    };

    return icons[variant] || 'info';
  }

  onBackdropClick(dialog: DialogConfig): void {
    if (dialog.type === 'alert') return;
    this.onCancel(dialog);
  }

  onConfirm(dialog: DialogConfig): void {
    if (dialog.onConfirm) {
      dialog.onConfirm(dialog.type === 'prompt' ? this.promptValue : undefined);
    }
    this.reset();
  }
  onCancel(dialog: DialogConfig) {
    if (dialog.onCancel) {
      dialog.onCancel();
    }
    this.reset();
  }
  reset(): void {
    this.promptValue = '';
    this.dialogService.close();
  }
}
