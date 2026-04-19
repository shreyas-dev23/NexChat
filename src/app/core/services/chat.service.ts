import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catchError, map, Observable, shareReplay, throwError } from 'rxjs';
import {
  Conversation,
  GroupMemberDetail,
  Message,
  SearchResult,
} from '../models/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private baseUrl = `${environment.apiUrl}/chat`;

  private conversations$: Observable<Conversation[]> | null = null;

  constructor(private http: HttpClient) {}

  getConversations() {
    if (!this.conversations$) {
      this.conversations$ = this.http
        .get<Conversation[]>(`${this.baseUrl}/conversations`)
        .pipe(
          map((conversations) =>
            conversations.sort(
              (a, b) =>
                new Date(b.lastMessageAt).getTime() -
                new Date(a.lastMessageAt).getTime(),
            ),
          ),
          shareReplay(1),
          catchError(this.handleError),
        );
    }
    return this.conversations$;
  }

  invalidateConversations(): void {
    this.conversations$ = null;
  }
  getChatHistory(userId: number): Observable<Message[]> {
    return this.http
      .get<Message[]>(`${this.baseUrl}/history/${userId}`)
      .pipe(catchError(this.handleError));
  }

  getAllUsers(): Observable<any> {
    return this.http
      .get<any[]>(`${this.baseUrl}/users`)
      .pipe(catchError(this.handleError));
  }

  getLastSeen(
    userId: number,
  ): Observable<{ userId: number; lastSeenAt: string | null }> {
    return this.http
      .get<{
        userId: number;
        lastSeenAt: string | null;
      }>(`${environment.apiUrl}/users/${userId}/last-seen`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let userMessage = 'Something went wrong. Please try again.';

    if (error.status === 0) {
      userMessage = 'Unable to connect to server. Check your connection.';
    } else if (error.status === 404) {
      userMessage = 'Conversation not found.';
    } else if (error.status === 500) {
      userMessage = 'Server error. Our team has been notified.';
    }

    console.error(`❌ ChatService Error [${error.status}]:`, error.message);
    return throwError(() => new Error(userMessage));
  }

  getGroups(): Observable<any[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/Groups/groups`)
      .pipe(catchError(this.handleError));
  }

  getGroupMessages(
    groupId: number,
    page: number = 1,
    pageSize: number = 50,
  ): Observable<any[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/groups/${groupId}/messages`, {
        params: {
          page: page.toString(),
          pageSize: pageSize.toString(),
        },
      })
      .pipe(catchError(this.handleError));
  }

  getGroupsMembers(groupId: number): Observable<GroupMemberDetail[]> {
    return this.http
      .get<
        GroupMemberDetail[]
      >(`${environment.apiUrl}/Groups/${groupId}/members`)
      .pipe(catchError(this.handleError));
  }
  searchUserMessages(
    otherUserId: number,
    query: string,
  ): Observable<SearchResult[]> {
    return this.http
      .get<
        any[]
      >(`${environment.apiUrl}/messages/search/user/${otherUserId}`, { params: { query } })
      .pipe(
        map((messages) =>
          messages.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            senderName: m.sender?.username ?? 'Unknown',
            content: m.content,
            sentAt: m.sentAt,
          })),
        ),
        catchError(this.handleError),
      );
  }

  searchGroupMessages(
    groupId: number,
    query: string,
  ): Observable<SearchResult[]> {
    return this.http
      .get<
        any[]
      >(`${environment.apiUrl}/messages/search/group/${groupId}`, { params: { query } })
      .pipe(
        map((messages) =>
          messages.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            senderName: m.sender?.username ?? 'Unknown',
            content: m.content,
            sentAt: m.sentAt,
          })),
        ),
        catchError(this.handleError),
      );
  }
}
