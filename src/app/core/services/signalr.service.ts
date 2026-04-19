// src/app/core/services/signalr.service.ts

import { Injectable, OnDestroy } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ConnectionState,
  HubEvents,
  IncomingMessage,
  LastSeenEvent,
  ReadReceipt,
} from '../models/chat.models';
import { AuthService } from './auth.service';

/**
 * 📡 SignalRService — Real-time messaging layer
 *
 * Syncs 1:1 with C# ChatHub:
 *   ✅ ReceiveMessage    → onMessageReceived
 *   ✅ UserOnline         → onUserOnline
 *   ✅ UserOffline        → onUserOffline
 *   ✅ UserTyping         → onUserTyping
 *   ✅ UserStoppedTyping  → onUserStoppedTyping
 *   ✅ MessageRead        → onMessageRead
 *   ✅ Error              → onHubError
 *
 * Client → Server:
 *   ✅ SendMessage(receiverUserId, message)
 *   ✅ Typing(receiverUserId)
 *   ✅ StopTyping(receiverUserId)
 *   ✅ MarkAsRead(senderUserId)
 */
@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  constructor(private authService: AuthService) {}
  // ═══════════════════════════════════════════
  // 🔌 Connection
  // ═══════════════════════════════════════════
  private hubConnection!: HubConnection;
  private readonly hubUrl = `${environment.hubUrl}`;

  // ═══════════════════════════════════════════
  // 📬 Observables (components subscribe)
  // ═══════════════════════════════════════════

  /** Connection state for UI indicator */
  readonly connectionState = new BehaviorSubject<ConnectionState>(
    'disconnected',
  );

  /** Incoming 1:1 messages */
  readonly onMessageReceived = new Subject<IncomingMessage>();

  /** User came online (userId) */
  readonly onUserOnline = new Subject<number>();

  /** User went offline (userId) */
  readonly onUserOffline = new Subject<number>();

  /** User started typing (userId) */
  readonly onUserTyping = new Subject<number>();

  /** User stopped typing (userId) */
  readonly onUserStoppedTyping = new Subject<number>();

  /** Messages were read by someone */
  readonly onMessageRead = new Subject<ReadReceipt>();

  /** Hub-level errors */
  readonly onHubError = new Subject<string>();

  readonly onUserLastSeen = new Subject<LastSeenEvent>();

  readonly onGroupCreated = new Subject<{ id: number; name: string }>();

  readonly onAddedToGroup = new Subject<{ groupId: number; addedBy: number }>();

  readonly onLeftGroup = new Subject<number>();

  readonly onMemberLeftGroup = new Subject<{
    groupId: number;
    userId: number;
  }>();

  readonly onRemovedFromGroup = new Subject<{
    groupId: number;
    removedBy: number;
  }>();
  readonly onGroupDeleted = new Subject<{
    groupId: number;
    deletedBy: number;
  }>();
  readonly onGroupMessageReceived = new Subject<{
    senderId: number;
    senderName: string;
    groupId: number;
    content: string;
    sentAt: string;
  }>();

  // ═══════════════════════════════════════════
  // 🚀 START CONNECTION
  // ═══════════════════════════════════════════

  async startConnection(): Promise<void> {
    // Guard: already connected or connecting
    if (
      this.hubConnection?.state === HubConnectionState.Connected ||
      this.hubConnection?.state === HubConnectionState.Connecting
    ) {
      return;
    }

    const token = this.authService.getToken() ?? '';

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(
        environment.production ? LogLevel.Warning : LogLevel.Information,
      )
      .build();

    // 1️⃣ Register ALL listeners BEFORE starting
    this.registerServerEvents();

    // 2️⃣ Register lifecycle hooks
    this.registerLifecycleHooks();

    // 3️⃣ Start with retry
    await this.connectWithRetry();
  }

  // ═══════════════════════════════════════════
  // 🎧 REGISTER SERVER → CLIENT EVENTS
  // ═══════════════════════════════════════════

  private registerServerEvents(): void {
    const hub = this.hubConnection;

    // ── 💬 ReceiveMessage ──
    // C# sends: SendAsync("ReceiveMessage", senderId, content, sentAt)
    hub.on(
      HubEvents.ReceiveMessage,
      (senderId: number, content: string, sentAt: string) => {
        this.onMessageReceived.next({ senderId, content, sentAt });
      },
    );

    // ── 🟢 UserOnline ──
    // C# sends: SendAsync("UserOnline", userId)
    hub.on(HubEvents.UserOnline, (userId: number) => {
      this.onUserOnline.next(userId);
    });

    // ── 🔴 UserOffline ──
    // C# sends: SendAsync("UserOffline", userId)
    hub.on(HubEvents.UserOffline, (userId: number) => {
      this.onUserOffline.next(userId);
    });

    // ── ✍️ UserTyping ──
    // C# sends: SendAsync("UserTyping", senderId)
    hub.on(HubEvents.UserTyping, (senderId: number) => {
      this.onUserTyping.next(senderId);
    });

    // ── ✋ UserStoppedTyping ──
    // C# sends: SendAsync("UserStoppedTyping", senderId)
    hub.on(HubEvents.UserStoppedTyping, (senderId: number) => {
      this.onUserStoppedTyping.next(senderId);
    });

    // ── 👁️ MessageRead ──
    // C# sends: SendAsync("MessageRead", { ReadByUserId, Timestamp })
    hub.on(HubEvents.MessageRead, (receipt: ReadReceipt) => {
      this.onMessageRead.next({
        readByUserId: receipt.readByUserId,
        timestamp: receipt.timestamp,
      });
    });

    // ── ❌ Error ──
    // C# sends: SendAsync("Error", errorMessage)
    hub.on(HubEvents.Error, (errorMsg: string) => {
      this.onHubError.next(errorMsg);
    });

    hub.on(HubEvents.userLastSeen, (data: LastSeenEvent) => {
      this.onUserLastSeen.next({
        userId: data.userId,
        lastSeenAt: data.lastSeenAt,
      });
    });

    hub.on(HubEvents.GroupCreated, (id: number, name: string) => {
      this.onGroupCreated.next({ id, name });
    });

    hub.on(
      HubEvents.ReceiveGroupMessage,
      (senderId: number, groupId: number, content: string, sentAt: string) => {
        this.onGroupMessageReceived.next({
          senderId,
          senderName: '',
          groupId,
          content,
          sentAt,
        });
      },
    );

    hub.on(
      HubEvents.AddedToGroup,
      (data: { groupId: number; addedBy: number }) => {
        this.onAddedToGroup.next(data);
      },
    );

    hub.on(HubEvents.LeftGroup, (groupId: number) => {
      this.onLeftGroup.next(groupId);
    });

    hub.on(
      HubEvents.MemberLeftGroup,
      (data: { groupId: number; userId: number }) => {
        this.onMemberLeftGroup.next(data);
      },
    );

    hub.on(
      HubEvents.RemovedFromGroup,
      (data: { groupId: number; removedBy: number }) => {
        this.onRemovedFromGroup.next(data);
      },
    );

    hub.on(
      HubEvents.GroupDeleted,
      (data: { groupId: number; deletedBy: number }) => {
        this.onGroupDeleted.next(data);
      },
    );
  }

  // ═══════════════════════════════════════════
  // 🔄 LIFECYCLE HOOKS
  // ═══════════════════════════════════════════

  private registerLifecycleHooks(): void {
    this.hubConnection.onreconnecting((error) => {
      console.warn('⚠️ SignalR reconnecting...', error?.message);
      this.connectionState.next('reconnecting');
    });

    this.hubConnection.onreconnected((connectionId) => {
      console.log('✅ SignalR reconnected:', connectionId);
      this.connectionState.next('connected');
    });

    this.hubConnection.onclose((error) => {
      console.warn('🔴 SignalR closed:', error?.message);
      this.connectionState.next('disconnected');
    });
  }

  // ═══════════════════════════════════════════
  // 🔁 CONNECT WITH RETRY
  // ═══════════════════════════════════════════

  private async connectWithRetry(maxAttempts = 5): Promise<void> {
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        await this.hubConnection.start();
        console.log('✅ SignalR connected');
        this.connectionState.next('connected');
        return;
      } catch (err: any) {
        attempt++;
        console.error(
          `❌ Connection attempt ${attempt}/${maxAttempts}:`,
          err.message,
        );

        if (attempt >= maxAttempts) {
          this.connectionState.next('disconnected');
          return;
        }

        // Wait before retrying (exponential backoff)
        await this.delay(Math.min(1000 * Math.pow(2, attempt), 30000));
      }
    }
  }

  // ═══════════════════════════════════════════
  // 📤 CLIENT → SERVER METHODS
  // ═══════════════════════════════════════════

  /**
   * Safely invoke a hub method.
   * Throws if not connected (caller handles the error).
   */
  private async invoke(method: string, ...args: any[]): Promise<void> {
    if (this.hubConnection?.state !== HubConnectionState.Connected) {
      throw new Error(`Cannot invoke "${method}" — not connected`);
    }
    await this.hubConnection.invoke(method, ...args);
  }

  // ── 💬 Send 1:1 Message ──
  // C# hub: SendMessage(string receiverUserId, string message)
  async sendMessage(receiverUserId: number, message: string): Promise<void> {
    await this.invoke(
      HubEvents.SendMessage,
      receiverUserId.toString(), // ✅ Hub expects string
      message,
    );
  }

  // ── ✍️ Typing ──
  // C# hub: Typing(string receiverUserId)
  async sendTyping(receiverUserId: number): Promise<void> {
    await this.invoke(HubEvents.Typing, receiverUserId.toString());
  }

  // ── ✋ Stop Typing ──
  // C# hub: StopTyping(string receiverUserId)
  async sendStopTyping(receiverUserId: number): Promise<void> {
    await this.invoke(HubEvents.StopTyping, receiverUserId.toString());
  }

  // ── 👁️ Mark as Read ──
  // C# hub: MarkAsRead(string senderUserId)
  async markAsRead(senderUserId: number): Promise<void> {
    await this.invoke(HubEvents.MarkAsRead, senderUserId.toString());
  }
  async addMembers(groupId: number, memeberIds: number[]): Promise<void> {
    await this.invoke(
      HubEvents.AddedMembersAsync,
      groupId.toString(),
      memeberIds,
    );
  }

  async createGroup(name: string): Promise<void> {
    await this.invoke(HubEvents.CreateGroupAsync, name);
  }

  async SendGroupMessage(groupId: number, message: string): Promise<void> {
    await this.invoke(HubEvents.SendGroupMessage, groupId.toString(), message);
  }

  async leaveGroup(groupId: number): Promise<void> {
    await this.invoke(HubEvents.LeaveGroupAsync, groupId.toString());
  }

  async removeMember(groupId: number, userId: number): Promise<void> {
    await this.invoke(
      HubEvents.RemoveMemberAsync,
      groupId.toString(),
      userId.toString(),
    );
  }

  async deleteGroup(groupId: number): Promise<void> {
    await this.invoke(HubEvents.DeleteGroupAsync, groupId.toString());
  }

  // ═══════════════════════════════════════════
  // 🧹 CLEANUP
  // ═══════════════════════════════════════════

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.connectionState.next('disconnected');
      console.log('🔴 SignalR stopped');
    }
  }

  ngOnDestroy(): void {
    this.stopConnection();
  }

  // ═══════════════════════════════════════════
  // 🔧 Utility
  // ═══════════════════════════════════════════

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
