import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { __param } from 'tslib';

@Injectable({
  providedIn: 'root',
})
export class DateHelperService {
  getSeparatorLabel(
    currentMsgDate: string | Date,
    previousMsgDate: string | Date | null,
  ): string | null {
    const current = this.toDate(currentMsgDate);

    if (!previousMsgDate) {
      return this.formatDateLabel(current);
    }

    const previous = this.toDate(previousMsgDate);

    if (this.isSameDay(current, previous)) {
      return null;
    }

    return this.formatDateLabel(current);
  }

  private formatDateLabel(date: Date): string {
    const now = new Date();
    const today = this.stripTime(now);
    const target = this.stripTime(date);

    const diffMs = today.getTime() - target.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';

    if (diffDays < 7) {
      return date.toLocaleDateString('en-us', { weekday: 'long' });
    }

    return date.toLocaleDateString('en-us', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  formatLastSeen(lastSeenAt: string | Date | null): string {
    debugger;
    if (!lastSeenAt) return 'Offline';

    const lastSeen = this.toDate(lastSeenAt);

    if (isNaN(lastSeen.getTime())) return 'Offline';

    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) {
      return 'Last seen just now';
    }

    if (diffMinutes < 60) {
      const unit = diffMinutes === 1 ? 'minute' : 'minutes';
      return `Last seen ${diffMinutes} ${unit} ago`;
    }

    if (diffHours < 2) {
      return 'Last seen 1 hour ago';
    }

    const timestr = this.formatTime(lastSeen);

    if (this.isToday(lastSeen)) {
      return `Last seen today at ${timestr}`;
    }

    if (this.isYesterday(lastSeen)) {
      return `Last seen yesterday at ${timestr}`;
    }

    if (this.isThisWeek(lastSeen)) {
      const dayName = lastSeen.toLocaleDateString('en-us', {
        weekday: 'long',
      });
      return `Last seen ${dayName} at ${timestr}`;
    }

    const dateStr = lastSeen.toLocaleDateString('en-us', {
      month: 'short',
      day: 'numeric',
    });

    return `Last seen ${dateStr} at ${timestr}`;
  }

  private toDate(value: string | Date): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private stripTime(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private isToday(date: Date): boolean {
    return this.isSameDay(date, new Date());
  }

  private isYesterday(date: Date): boolean {
    const yesterday = new Date();

    yesterday.setDate(yesterday.getDate() - 1);
    return this.isSameDay(date, yesterday);
  }

  private isThisWeek(date: Date): boolean {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs < 7 * 24 * 60 * 60 * 1000;
  }

  private formatTime(date: Date): string {
    debugger;
    return date.toLocaleTimeString('en-us', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
