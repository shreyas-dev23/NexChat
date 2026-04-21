// src/app/chat/chat.component.ts

import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import {
  catchError,
  takeUntil,
  finalize,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs/operators';

import { ChatService } from '../../core/services/chat.service';
import { SignalRService } from '../../core/services/signalr.service';
import { AuthService } from '../../core/services/auth.service';
import {
  Conversation,
  Message,
  IncomingMessage,
  ReadReceipt,
  ConnectionState,
  LastSeenEvent,
  SidebarItem,
  SelectableUser,
  GroupMemberDetail,
  SearchResult,
} from '../../core/models/chat.models';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconsModule } from '../../shared/icons.module';
import { DateHelperService } from '../../core/services/date-helper.service';
import { TitleStrategy } from '@angular/router';
import { group } from '@angular/animations';
import { DialogService } from '../../shared/services/dialog.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, UpperCasePipe, IconsModule],
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  clearChat() {
    throw new Error('Method not implemented.');
  }
  // ═══════════════════════════════════════════
  // 📌 Data State
  // ═══════════════════════════════════════════
  conversations: Conversation[] = [];
  messages: Message[] = [];
  selectedUser: Conversation | null = null;
  currentUserId: number;

  showAllUsers = false;
  allUsers: any[] = [];
  searchQuery = '';

  // ═══════════════════════════════════════════
  // 🎛️ UI State
  // ═══════════════════════════════════════════
  newMessage = '';
  isLoadingConversations = false;
  isLoadingHistory = false;
  isSending = false;
  errorMessage = '';
  connectionState: ConnectionState = 'disconnected';

  //Groups Data
  sidebarItems: SidebarItem[] = [];
  selectedItem: SidebarItem | null = null;

  private groups: any[] = [];
  showCreateGroupModal = false;
  newGroupName = '';

  selectableUsers: SelectableUser[] = [];

  memberSearchQuery = '';

  filteredSelectableUsers: SelectableUser[] = [];

  isCreatingGroup = false;
  createGroupError = '';

  //search state
  showSearchBox = false;
  messageSearchQuery = '';
  searchResults: SearchResult[] = [];
  isSearching = false;
  private searchInput$ = new Subject<string>();

  showMoreMenu = false;

  toggleMoreMenu(): void {
    this.showMoreMenu = !this.showMoreMenu;
  }
  closeMoreMenu(): void {
    this.showMoreMenu = false;
  }
  // ═══════════════════════════════════════════
  // 🕐 LAST SEEN (NEW)
  // ═══════════════════════════════════════════
  //
  // lastSeenDisplay holds the formatted text like
  // "Last seen 5 minutes ago" that shows in the header.
  //
  // lastSeenInterval is a timer that updates this text
  // every 60 seconds so "5 min ago" becomes "6 min ago".
  //
  lastSeenDisplay = '';
  private lastSeenInterval: any = null;
  // ═══════════════════════════════════════════
  // ✍️ Typing State
  // ═══════════════════════════════════════════
  private isCurrentlyTyping = false;
  private typingTimeout: any = null;
  private typingInput$ = new Subject<void>();

  //Add members modal
  showAddMembersModal = false;
  addMembersGroupId: number | null = null;
  addMembersGroupName = '';
  isAddingMembers = false;
  addMembersError = '';
  showGroupInfoPanel = false;
  groupMembers: GroupMemberDetail[] = [];
  isLoadingMembers = false;
  currentUserIsAdmin = false;
  // ═══════════════════════════════════════════
  // 🔧 Internal
  // ═══════════════════════════════════════════
  @ViewChild('messageContainer') messageContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;
  private shouldScroll = false;
  private destroy$ = new Subject<void>();
  isLoadingUsers: boolean = false;

  constructor(
    private chatService: ChatService,
    private signalR: SignalRService,
    private auth: AuthService,
    public dateHelper: DateHelperService,
    private dialog: DialogService,
  ) {
    this.currentUserId = this.auth.getUserId();
  }
  get filteredUsers() {
    if (!this.searchQuery.trim()) {
      return this.allUsers;
    }
    return this.allUsers.filter((user) =>
      user.username.toLowerCase().includes(this.searchQuery.toLowerCase()),
    );
  }

  get isGroupChat(): boolean {
    return this.selectedItem?.type === 'group';
  }

  private buildSidebar(): void {
    const userItems: SidebarItem[] = this.conversations.map((c) => ({
      id: `user-${c.userId}`,
      type: 'user' as const,
      name: c.username,
      userId: c.userId,
      groupId: null,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
      isOnline: c.isOnline,
      isTyping: c.isTyping ?? false,
      lastSeenAt: c.lastMessageAt ?? null,
      memberCount: null,
    }));

    const groupItems: SidebarItem[] = this.groups.map((g) => ({
      id: `group-${g.id}`,
      type: 'group' as const,
      name: g.name,
      userId: null,
      groupId: g.id,
      lastMessage: g.lastMessage ?? '',
      lastMessageAt: g.lastMessageAt ?? new Date(0).toISOString(),
      unreadCount: g.unreadCount ?? 0,
      isOnline: false,
      isTyping: false,
      lastSeenAt: null,
      memberCount: g.memberCount ?? 0,
    }));

    this.sidebarItems = [...userItems, ...groupItems].sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
  }
  // Load all users
  loadAllUsers(): void {
    this.showAllUsers = true;
    this.isLoadingUsers = true;

    // Your API call here
    this.chatService.getAllUsers().subscribe({
      next: (users) => {
        this.allUsers = users;
        this.isLoadingUsers = false;
      },
      error: () => {
        this.isLoadingUsers = false;
      },
    });
  }

  // Start chat with user
  startChat(user: any): void {
    this.showAllUsers = false;
    this.searchQuery = '';
    this.selectUser(user);
  }

  // ═══════════════════════════════════════════
  // 🔄 LIFECYCLE
  // ═══════════════════════════════════════════

  async ngOnInit(): Promise<void> {
    // 1️⃣ Load sidebar
    this.loadConversations();

    // 2️⃣ Start SignalR
    await this.signalR.startConnection();

    // 3️⃣ Subscribe to ALL hub events
    this.subscribeToMessages();
    this.subscribeToPresence();
    this.subscribeToTyping();
    this.subscribeToReadReceipts();
    this.subscribeToLastSeen();
    this.subscribeToConnection();
    this.subscribeToGroupEvents();
    this.subscribeToErrors();

    // 4️⃣ Setup debounced typing emission
    this.typingInput$
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => this.emitTyping());

    this.searchInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) => {
        this.performSearch(query);
      });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.signalR.stopConnection();
    clearTimeout(this.typingTimeout);
    this.stopLastSeenTimer();
  }

  // ═══════════════════════════════════════════
  // 🎧 SUBSCRIBE: Messages
  // ═══════════════════════════════════════════

  private subscribeToMessages(): void {
    this.signalR.onMessageReceived
      .pipe(takeUntil(this.destroy$))
      .subscribe((incoming: IncomingMessage) => {
        this.handleIncomingMessage(incoming);
      });
  }

  private handleIncomingMessage(incoming: IncomingMessage): void {
    const message: Message = {
      senderId: incoming.senderId,
      receiverId: this.currentUserId,
      content: incoming.content,
      sentAt: incoming.sentAt ?? new Date().toISOString(),
      isMine: false,
      isRead: false,
    };

    // ── Is this message for the currently open chat? ──
    const isRelevant =
      this.selectedUser && incoming.senderId === this.selectedUser.userId;

    if (isRelevant) {
      this.messages.push(message);
      this.shouldScroll = true;

      // ✅ Auto-mark as read since chat is open
      this.signalR.markAsRead(incoming.senderId).catch(() => {});

      // ✅ Clear typing indicator (they sent a message)
      if (this.selectedUser) {
        this.selectedUser.isTyping = false;
      }
    }

    // ── Update sidebar ──
    this.updateConversationPreview(
      incoming.senderId,
      incoming.content,
      !isRelevant, // increment unread only if NOT viewing
    );
  }

  // ═══════════════════════════════════════════
  // 🎧 SUBSCRIBE: Online / Offline
  // ═══════════════════════════════════════════

  private subscribeToPresence(): void {
    // 🟢 User came online
    this.signalR.onUserOnline
      .pipe(takeUntil(this.destroy$))
      .subscribe((userId: number) => {
        const convo = this.conversations.find((c) => c.userId === userId);
        if (convo) {
          convo.isOnline = true;
        }

        const sidebarItem = this.sidebarItems.find(
          (i) => i.type === 'user' && i.userId === userId,
        );
        if (sidebarItem) sidebarItem.isOnline = true;

        // Update header if chatting with this user
        if (this.selectedUser?.userId === userId) {
          this.selectedUser.isOnline = true;
        }
        this.lastSeenDisplay = '';
        this.stopLastSeenTimer();
      });

    // 🔴 User went offline
    this.signalR.onUserOffline
      .pipe(takeUntil(this.destroy$))
      .subscribe((userId: number) => {
        const convo = this.conversations.find((c) => c.userId === userId);
        if (convo) {
          convo.isOnline = false;
          convo.isTyping = false;
        }
        const sidebarItem = this.sidebarItems.find(
          (i) => i.type === 'user' && i.userId === userId,
        );
        if (sidebarItem) {
          sidebarItem.isTyping = false;
          sidebarItem.isOnline = false;
        }
        if (this.selectedUser?.userId === userId) {
          this.selectedUser.isOnline = false;
          this.selectedUser.isTyping = false;
        }
      });
  }
  // ═══════════════════════════════════════════
  // 🎧 LAST SEEN (✅ NEW)
  // ═══════════════════════════════════════════
  //
  // When does this fire?
  //   → When someone disconnects from the hub
  //   → The hub broadcasts their userId + lastSeenAt
  //   → We receive it here
  //
  // What do we do with it?
  //   1. Save it on the conversation object (sidebar)
  //   2. If we're chatting with this person, update the header
  //   3. Start a timer to keep "5 min ago" → "6 min ago" fresh
  //

  private subscribeToLastSeen(): void {
    this.signalR.onUserLastSeen
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: LastSeenEvent) => {
        // Step 1: Update sidebar data
        const convo = this.findConversation(event.userId);
        if (convo) {
          convo.lastSeenAt = event.lastSeenAt;
        }

        // Step 2: Update header if this is the active chat
        if (this.selectedUser?.userId === event.userId) {
          this.selectedUser.lastSeenAt = event.lastSeenAt;
          this.refreshLastSeenDisplay();
          this.startLastSeenTimer();
        }
      });
  }
  private findConversation(userId: number): Conversation | undefined {
    return this.conversations.find((c) => c.userId === userId);
  }

  // ═══════════════════════════════════════════
  // 🕐 LAST SEEN DISPLAY HELPERS (✅ NEW)
  // ═══════════════════════════════════════════

  /**
   * Updates the header text to show current "Last seen X ago".
   *
   * Called:
   *   1. When we receive a LastSeen event from hub
   *   2. When we select a user (from API data)
   *   3. Every 60 seconds by the timer
   */
  private refreshLastSeenDisplay(): void {
    if (!this.selectedUser) {
      this.lastSeenDisplay = '';
      return;
    }

    // If they're online, don't show last seen
    if (this.selectedUser.isOnline) {
      this.lastSeenDisplay = '';
      return;
    }

    // Convert timestamp to "Last seen 5 minutes ago"
    this.lastSeenDisplay = this.dateHelper.formatLastSeen(
      this.selectedUser.lastSeenAt,
    );
  }
  /**
   * Starts a timer that refreshes "Last seen X ago" every 60 seconds.
   *
   * WHY?
   *   Without this, "Last seen 5 min ago" would stay as
   *   "5 min ago" forever, even after 30 minutes pass.
   *   The timer makes it update to "6 min ago", "7 min ago", etc.
   */
  private startLastSeenTimer(): void {
    this.stopLastSeenTimer(); // Clear any existing timer

    this.lastSeenInterval = setInterval(() => {
      this.refreshLastSeenDisplay();
    }, 60_000); // Every 60 seconds
  }

  /** Stop the refresh timer (when switching chats or going online) */
  private stopLastSeenTimer(): void {
    if (this.lastSeenInterval) {
      clearInterval(this.lastSeenInterval);
      this.lastSeenInterval = null;
    }
  }

  // ═══════════════════════════════════════════
  // 🎧 SUBSCRIBE: Typing Indicators
  // ═══════════════════════════════════════════

  private subscribeToTyping(): void {
    // ✍️ Someone started typing
    this.signalR.onUserTyping
      .pipe(takeUntil(this.destroy$))
      .subscribe((userId: number) => {
        this.setUserTyping(Number(userId), true);
      });

    // ✋ Someone stopped typing
    this.signalR.onUserStoppedTyping
      .pipe(takeUntil(this.destroy$))
      .subscribe((userId: number) => {
        this.setUserTyping(Number(userId), false);
      });
  }

  // ═══════════════════════════════════════════
  // 🎧 SUBSCRIBE: Read Receipts
  // ═══════════════════════════════════════════

  private subscribeToReadReceipts(): void {
    this.signalR.onMessageRead
      .pipe(takeUntil(this.destroy$))
      .subscribe((receipt: ReadReceipt) => {
        // ✅ If the person who read is our current chat partner
        if (this.selectedUser?.userId === receipt.readByUserId) {
          // Mark all OUR sent messages as read
          this.messages.forEach((msg) => {
            if (msg.isMine) {
              msg.isRead = true;
              msg.status = 'read';
            }
          });
        }
      });
  }

  // ═══════════════════════════════════════════
  // 🎧 SUBSCRIBE: Connection State
  // ═══════════════════════════════════════════

  private subscribeToConnection(): void {
    this.signalR.connectionState
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: ConnectionState) => {
        this.connectionState = state;
      });
  }

  // ═══════════════════════════════════════════
  // 🎧 SUBSCRIBE: Hub Errors
  // ═══════════════════════════════════════════

  private subscribeToErrors(): void {
    this.signalR.onHubError
      .pipe(takeUntil(this.destroy$))
      .subscribe((error: string) => {
        console.error('Hub error:', error);
        this.errorMessage = error;

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          if (this.errorMessage === error) {
            this.errorMessage = '';
          }
        }, 5000);
      });
  }

  // ═══════════════════════════════════════════
  // 👥 CONVERSATIONS (Sidebar)
  // ═══════════════════════════════════════════

  loadConversations(): void {
    this.isLoadingConversations = true;

    forkJoin({
      conversations: this.chatService.getConversations(),
      groups: this.chatService.getGroups().pipe(catchError(() => of([]))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingConversations = false)),
      )
      .subscribe({
        next: ({ conversations, groups }) => {
          this.conversations = conversations.map((c) => ({
            ...c,
            isTyping: false,
            lastSeenAt: (c as any).lastSeenAt ?? null,
          }));
          this.groups = groups;
          this.buildSidebar();
        },
        error: (err) => {
          this.errorMessage = err.message;
        },
      });

    /*
    this.chatService
      .getConversations()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingConversations = false)),
      )
      .subscribe({
        next: (data) => {
          // ✅ Add isTyping field (API won't have it)
          this.conversations = data.map((c) => ({
            ...c,
            isTyping: false,
          }));
        },
        error: (err) => {
          this.errorMessage = err.message;
        },
      });
    */
  }

  // ═══════════════════════════════════════════
  // 👆 SELECT USER
  // ═══════════════════════════════════════════

  selectUser(user: Conversation): void {
    if (this.selectedUser?.userId === user.userId) return;

    // ✅ Stop typing indicator for previous user
    if (this.selectedUser && this.isCurrentlyTyping) {
      this.signalR.sendStopTyping(this.selectedUser.userId).catch(() => {});
      this.isCurrentlyTyping = false;
      clearTimeout(this.typingTimeout);
    }

    this.selectedUser = user;
    this.selectedItem = {
      id: `user-${user.userId}`,
      type: 'user',
      name: user.username,
      userId: user.userId,
      groupId: null,
      lastMessage: user.lastMessage ?? '',
      lastMessageAt: user.lastMessageAt ?? new Date().toISOString(),
      unreadCount: user.unreadCount ?? 0,
      isOnline: user.isOnline ?? false,
      isTyping: user.isTyping ?? false,
      lastSeenAt: user.lastSeenAt ?? null,
      memberCount: null,
    };
    this.messages = [];
    this.errorMessage = '';
    this.newMessage = '';

    this.loadChatHistory(user.userId);

    // Step 5: Load last seen ✅ NEW
    this.loadLastSeen(user);
    // Clear unread badge
    user.unreadCount = 0;

    // ✅ Mark messages as read when opening chat
    this.signalR.markAsRead(user.userId).catch(() => {});

    // Focus input
    setTimeout(() => this.messageInput?.nativeElement?.focus(), 100);
  }

  // ═══════════════════════════════════════════
  // 🕐 LOAD LAST SEEN ON USER SELECT (✅ NEW)
  // ═══════════════════════════════════════════
  //
  // Called when you click on a user in the sidebar.
  //
  // Three scenarios:
  //   A) User is ONLINE → don't show last seen
  //   B) We already have lastSeenAt data → use it immediately
  //   C) We don't have data → fetch from API
  //

  private loadLastSeen(user: Conversation): void {
    // Scenario A: They're online right now
    if (user.isOnline) {
      this.lastSeenDisplay = '';
      this.stopLastSeenTimer();
      return;
    }

    // Scenario B: We already have the timestamp
    // (maybe from a previous UserLastSeen event)
    if (user.lastSeenAt) {
      this.refreshLastSeenDisplay();
      this.startLastSeenTimer();
      return;
    }

    // Scenario C: We need to ask the server
    this.chatService.getLastSeen(user.userId).subscribe({
      next: (data) => {
        // Make sure we're still looking at this user
        // (user might have clicked someone else while API was loading)
        if (this.selectedUser?.userId === user.userId) {
          this.selectedUser.lastSeenAt = data.lastSeenAt;
          this.refreshLastSeenDisplay();

          if (data.lastSeenAt) {
            this.startLastSeenTimer();
          }
        }
      },
      error: () => {
        this.lastSeenDisplay = 'Offline';
      },
    });
  }

  // ═══════════════════════════════════════════
  // 📜 LOAD CHAT HISTORY (✅ UPDATED)
  // ═══════════════════════════════════════════
  //
  // NEW: After loading messages, we process them
  // to add date separator labels.
  //

  loadChatHistory(userId: number): void {
    this.isLoadingHistory = true;

    this.chatService
      .getChatHistory(userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingHistory = false)),
      )
      .subscribe({
        next: (history) => {
          // Step 1: Add isMine flag
          const mapped = history.map((msg) => ({
            ...msg,
            isMine: msg.senderId === this.currentUserId,
          }));

          // Step 2: Process date separators ✅ NEW
          this.messages = this.processDateSeparators(mapped);
          this.shouldScroll = true;
        },
        error: (err) => (this.errorMessage = err.message),
      });
  }
  // ═══════════════════════════════════════════
  // 📅 DATE SEPARATOR PROCESSING (✅ NEW)
  // ═══════════════════════════════════════════
  //
  // Takes an array of messages and marks which ones
  // need a date separator above them.
  //
  // EXAMPLE:
  //   Input:  [msg Jan14, msg Jan14, msg Jan15, msg Jan15]
  //   Output: [msg Jan14 (separator:"Yesterday"),
  //            msg Jan14 (no separator),
  //            msg Jan15 (separator:"Today"),
  //            msg Jan15 (no separator)]
  //

  private processDateSeparators(messages: Message[]): Message[] {
    return messages.map((msg, index) => {
      // Get the previous message's date (null if this is the first message)
      const previousDate = index > 0 ? messages[index - 1].sentAt : null;

      // Ask DateHelper: "Should we show a separator?"
      const label = this.dateHelper.getSeparatorLabel(msg.sentAt, previousDate);

      return {
        ...msg,
        showDateSeparator: label !== null, // true = show the bar
        dateSeparatorLabel: label ?? undefined, // "Today", "Yesterday", etc.
      };
    });
  }

  /**
   * Adds a SINGLE new message with separator check.
   *
   * Used for:
   *   - Incoming real-time messages
   *   - Optimistic messages when you send
   *
   * WHY is this separate from processDateSeparators?
   *   processDateSeparators works on the FULL array (for initial load).
   *   This function works on ONE message (for real-time additions).
   */
  private addMessageWithSeparator(message: Message): void {
    // Get the last message currently in the chat
    const lastMsg =
      this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;

    // Check if this new message is on a different day
    const label = this.dateHelper.getSeparatorLabel(
      message.sentAt,
      lastMsg?.sentAt ?? null,
    );

    message.showDateSeparator = label !== null;
    message.dateSeparatorLabel = label ?? undefined;

    this.messages.push(message);
  }

  // ═══════════════════════════════════════════
  // 📤 SEND MESSAGE
  // ═══════════════════════════════════════════

  async send(): Promise<void> {
    const trimmed = this.newMessage.trim();
    if (!trimmed || !this.selectedItem || this.isSending) return;

    this.isSending = true;

    // ✅ Stop typing before sending
    if (this.isCurrentlyTyping && this.selectedUser) {
      this.signalR.sendStopTyping(this.selectedUser.userId).catch(() => {});
      this.isCurrentlyTyping = false;
      clearTimeout(this.typingTimeout);
    }

    // Optimistic UI
    const optimisticMsg: Message = {
      senderId: this.currentUserId,
      receiverId:
        this.selectedItem.type === 'user' ? this.selectedItem.userId! : 0,
      groupId:
        this.selectedItem.type === 'group'
          ? this.selectedItem.groupId!
          : undefined,
      content: trimmed,
      sentAt: new Date().toISOString(),
      isMine: true,
      isRead: false,
      status: 'sending',
      senderName: 'You',
    };
    // ✅ Add with separator check (not plain push)
    this.addMessageWithSeparator(optimisticMsg);
    this.shouldScroll = true;
    this.newMessage = '';

    // Update sidebar preview
    this.updateSidebarItem(
      this.selectedItem!.id,
      this.selectedItem?.type === 'group' ? `You:${trimmed}` : trimmed,
      false,
    );

    try {
      if (this.selectedItem?.type === 'group' && this.selectedItem.groupId) {
        await this.signalR.SendGroupMessage(this.selectedItem.groupId, trimmed);
      } else if (
        this.selectedItem?.type === 'user' &&
        this.selectedItem.userId
      ) {
        await this.signalR.sendMessage(this.selectedItem.userId, trimmed);
      }

      // ✅ Mark as sent
      optimisticMsg.status = 'sent';
    } catch (error) {
      // ✅ Mark as failed + allow retry
      optimisticMsg.status = 'failed';
      this.messages = this.messages.filter((m) => m !== optimisticMsg);
      this.errorMessage = 'Failed to send message. Please try again.';
    } finally {
      this.isSending = false;
    }
  }

  // ═══════════════════════════════════════════
  // 🔁 RETRY FAILED MESSAGE
  // ═══════════════════════════════════════════

  async retryMessage(msg: Message): Promise<void> {
    if (msg.status !== 'failed' || !this.selectedUser) return;

    msg.status = 'sending';

    try {
      await this.signalR.sendMessage(this.selectedUser.userId, msg.content);
      msg.status = 'sent';
    } catch {
      msg.status = 'failed';
    }
  }

  // ═══════════════════════════════════════════
  // ✍️ TYPING INDICATOR LOGIC
  // ═══════════════════════════════════════════

  /**
   * Called on every keyup in the input field.
   * Enter → send. Other keys → trigger typing.
   */
  onInputKeyup(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
      return;
    }

    // Trigger debounced typing
    if (this.selectedUser && this.newMessage.trim()) {
      this.typingInput$.next();
    }
  }

  /**
   * Called after debounce. Sends typing event to hub
   * and auto-stops after 3 seconds of no input.
   */
  private emitTyping(): void {
    if (!this.selectedUser || !this.newMessage.trim()) return;

    // Send "typing" only once (not on every keystroke)
    if (!this.isCurrentlyTyping) {
      this.isCurrentlyTyping = true;
      this.signalR.sendTyping(this.selectedUser.userId).catch(() => {});
    }

    // Reset the auto-stop timer
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      if (this.selectedUser && this.isCurrentlyTyping) {
        this.signalR.sendStopTyping(this.selectedUser.userId).catch(() => {});
        this.isCurrentlyTyping = false;
      }
    }, 3000);
  }

  /**
   * Called when input is cleared (user deleted text).
   * Immediately stops typing indicator.
   */
  onInputChange(): void {
    const hasText = !!this.newMessage.trim();

    if (hasText && this.selectedUser) {
      this.typingInput$.next();
      return;
    }

    if (!hasText && this.isCurrentlyTyping && this.selectedUser) {
      this.signalR.sendStopTyping(this.selectedUser.userId).catch(() => {});
      this.isCurrentlyTyping = false;
      clearTimeout(this.typingTimeout);
    }
  }

  // ═══════════════════════════════════════════
  // 🔧 SIDEBAR HELPERS
  // ═══════════════════════════════════════════

  private updateConversationPreview(
    userId: number,
    lastMessage: string,
    incrementUnread: boolean,
  ): void {
    const lastMessageAt = new Date().toISOString();
    const convo = this.conversations.find((c) => c.userId === userId);
    if (convo) {
      convo.lastMessage = lastMessage;
      convo.lastMessageAt = lastMessageAt;
      convo.isTyping = false;
      if (incrementUnread) {
        convo.unreadCount = (convo.unreadCount || 0) + 1;
      }
      // Re-sort: most recent first
      this.conversations.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
    }

    this.updateUserSidebarItem(userId, {
      lastMessage,
      lastMessageAt,
      incrementUnread,
      isTyping: false,
    });
  }

  private setUserTyping(userId: number, isTyping: boolean): void {
    const convo = this.conversations.find((c) => c.userId === userId);
    if (convo) {
      convo.isTyping = isTyping;
    }

    if (this.selectedUser?.userId === userId) {
      this.selectedUser.isTyping = isTyping;
    }

    this.updateUserSidebarItem(userId, { isTyping });
  }

  private updateUserSidebarItem(
    userId: number,
    changes: {
      lastMessage?: string;
      lastMessageAt?: string;
      incrementUnread?: boolean;
      isTyping?: boolean;
    },
  ): void {
    const item = this.sidebarItems.find(
      (i) => i.type === 'user' && i.userId === userId,
    );
    if (!item) return;

    if (changes.lastMessage !== undefined) {
      item.lastMessage = changes.lastMessage;
    }
    if (changes.lastMessageAt !== undefined) {
      item.lastMessageAt = changes.lastMessageAt;
    }
    if (changes.incrementUnread) {
      item.unreadCount = (item.unreadCount || 0) + 1;
    }
    if (changes.isTyping !== undefined) {
      item.isTyping = changes.isTyping;
    }

    if (this.selectedItem?.id === item.id) {
      this.selectedItem = item;
    }

    this.sidebarItems = [...this.sidebarItems].sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
  }

  // ═══════════════════════════════════════════
  // 🔧 TEMPLATE HELPERS
  // ═══════════════════════════════════════════

  private scrollToBottom(): void {
    try {
      const el = this.messageContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch {}
  }

  trackByConversation(_index: number, convo: Conversation): number {
    return convo.userId;
  }

  trackByMessage(index: number, msg: Message): string {
    return msg.id
      ? msg.id.toString()
      : `${msg.senderId}-${msg.sentAt}-${index}`;
  }

  isSelected(user: Conversation): boolean {
    return this.selectedUser?.userId === user.userId;
  }
  goBack(): void {
    this.selectedUser = null;
    this.selectedItem = null;
  }

  selectItem(item: SidebarItem): void {
    if (this.selectedItem?.id === item.id) return;

    if (this.selectedItem && this.isCurrentlyTyping) {
      if (this.selectedUser) {
        this.signalR.sendStopTyping(this.selectedUser.userId).catch(() => {});
      }
      this.isCurrentlyTyping = false;
      clearTimeout(this.typingTimeout);
    }

    this.selectedItem = item;
    this.messages = [];
    this.errorMessage = '';
    this.newMessage = '';

    if (item.type === 'user' && item.userId) {
      const convo = this.conversations.find((c) => c.userId === item.userId);
      if (convo) {
        this.selectedUser = convo;
        this.loadChatHistory(item.userId);
        this.loadLastSeen(convo);
        convo.unreadCount = 0;
        this.signalR.markAsRead(item.userId).catch(() => {});
      }
    } else if (item.type === 'group' && item.groupId) {
      this.selectedUser = null;
      this.lastSeenDisplay = '';
      this.stopLastSeenTimer();
      this.loadGroupHistory(item.groupId);
    }

    item.unreadCount = 0;

    setTimeout(() => {
      this.messageInput?.nativeElement?.focus();
    }, 100);
  }

  private subscribeToGroupEvents(): void {
    this.signalR.onGroupCreated
      .pipe(takeUntil(this.destroy$))
      .subscribe((group) => {
        this.groups.push({
          id: group.id,
          name: group.name,
          memberCount: 1 + this.selectedMembers.length,
          lastMessage: '',
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
        });
        this.buildSidebar(); // Rebuild to include new group
      });
    this.signalR.onAddedToGroup
      .pipe(takeUntil(this.destroy$))
      .subscribe(async ({ groupId, addedBy }) => {
        this.chatService.getGroups().subscribe((groups) => {
          this.groups = groups;
          this.buildSidebar();

          const adderName = this.resolveSenderName(addedBy);
          const group = groups.find((g) => g.id === groupId);

          if (group) {
            console.log(`${adderName} added you to ${group.name}`);
          }
        });
      });
    this.signalR.onGroupMessageReceived
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        const senderName = this.resolveSenderName(msg.senderId);
        const isFromMe = msg.senderId === this.currentUserId;
        const isViewing =
          this.selectedItem?.type === 'group' &&
          this.selectedItem?.groupId === msg.groupId;

        if (isViewing && !isFromMe) {
          const message: Message = {
            id: undefined,
            senderId: msg.senderId,
            receiverId: 0,
            groupId: msg.groupId,
            content: msg.content,
            sentAt: msg.sentAt,
            isMine: false,
            senderName: senderName,
            status: undefined,
          };
          this.addMessageWithSeparator(message);
          this.shouldScroll = true;
        }

        const preview = isFromMe
          ? `You:${msg.content}`
          : `${senderName}:${msg.content}`;

        this.updateSidebarItem(
          `group-${msg.groupId}`,
          preview,
          !isViewing && !isFromMe,
        );
      });

    this.signalR.onLeftGroup
      .pipe(takeUntil(this.destroy$))
      .subscribe((groupId) => {
        this.groups = this.groups.filter((g) => g.id !== groupId);
        this.buildSidebar();

        if (
          this.selectedItem?.type === 'group' &&
          this.selectedItem.groupId === groupId
        ) {
          this.selectedItem = null;
          this.selectedUser = null;
          this.messages = [];
          this.showGroupInfoPanel = false;
        }
      });

    this.signalR.onMemberLeftGroup
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ groupId, userId }) => {
        if (this.showGroupInfoPanel && this.selectedItem?.groupId === groupId) {
          this.groupMembers = this.groupMembers.filter(
            (m) => m.userId !== userId,
          );
        }

        const groupItem = this.sidebarItems.find(
          (i) => i.type === 'group' && i.groupId === groupId,
        );

        if (groupItem && groupItem.memberCount !== null) {
          groupItem.memberCount--;

          if (this.selectedItem?.id === groupItem.id) {
            this.selectedItem = { ...groupItem };
          }

          const group = this.groups.find((g) => g.id === groupId);

          if (group) {
            group.memberCount = (group.memberCount || 1) - 1;
          }
        }
      });

    this.signalR.onRemovedFromGroup
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ groupId, removedBy }) => {
        this.groups = this.groups.filter((g) => g.id === groupId);
        this.buildSidebar();

        if (
          this.selectedItem?.type === 'group' &&
          this.selectedItem.groupId === groupId
        ) {
          this.selectedItem = null;
          this.selectedUser = null;
          this.messages = [];
          this.showGroupInfoPanel = false;
        }

        const removerName = this.resolveSenderName(removedBy);
        alert(`${removerName} removed you from the group`);
      });

    this.signalR.onGroupDeleted
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ groupId, deletedBy }) => {
        //
        // Remove group from sidebar
        //
        this.groups = this.groups.filter((g) => g.id !== groupId);
        this.buildSidebar();

        if (
          this.selectedItem?.type === 'group' &&
          this.selectedItem.groupId === groupId
        ) {
          this.selectedItem = null;
          this.selectedUser = null;
          this.messages = [];
          this.showGroupInfoPanel = false;
        }

        const deleterName = this.resolveSenderName(deletedBy);
        const wasMe = deletedBy === this.currentUserId;

        if (wasMe) {
          console.log(`You deleted the group`);
        } else {
          alert(`⚠️ ${deleterName} deleted the group`);
        }
      });
  }

  private resolveSenderName(senderId: number): string {
    if (senderId === this.currentUserId) return 'You';
    const convo = this.conversations.find((c) => c.userId === senderId);
    return convo?.username ?? `User ${senderId}`;
  }

  private updateSidebarItem(
    itemId: string,
    lastMessage: string,
    incrementUnread: boolean,
  ): void {
    const item = this.sidebarItems.find((i) => i.id === itemId);
    if (!item) return;

    item.lastMessage = lastMessage;
    item.lastMessageAt = new Date().toISOString();
    if (incrementUnread) item.unreadCount++;

    if (this.selectedItem?.id === item.id) {
      this.selectedItem = item;
    }

    this.sidebarItems = [...this.sidebarItems].sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
  }
  trackBySidebarItem(_: number, item: SidebarItem): string {
    return item.id;
  }

  loadGroupHistory(groupId: number): void {
    this.isLoadingHistory = true;

    this.chatService
      .getGroupMessages(groupId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingHistory = false)),
      )
      .subscribe({
        next: (history) => {
          const mapped: Message[] = history.map((msg) => ({
            id: msg.id,
            senderId: msg.senderId,
            receiverId: 0,
            groupId: groupId,
            content: msg.content,
            sentAt: msg.sentAt,
            isMine: msg.senderId === this.currentUserId,

            senderName: msg.senderName,
            isRead: true,
            status: undefined,
          }));

          this.messages = this.processDateSeparators(mapped);
          this.shouldScroll = true;
        },
        error: (err) => (this.errorMessage = err.message),
      });
  }

  openCreateGroupModal(): void {
    this.resetCreateGroupModal();

    this.selectableUsers = this.conversations.map((c) => ({
      userId: c.userId,
      username: c.username,
      isOnline: c.isOnline,
      selected: false,
    }));

    this.filteredSelectableUsers = [...this.selectableUsers];
    this.showCreateGroupModal = true;
  }

  onMemberSearch(): void {
    const query = this.memberSearchQuery.toLowerCase().trim();

    this.filteredSelectableUsers = query
      ? this.selectableUsers.filter((u) =>
          u.username.toLowerCase().includes(query),
        )
      : [...this.selectableUsers];
  }

  toggleMember(user: SelectableUser): void {
    user.selected = !user.selected;
  }

  get selectedMembers(): SelectableUser[] {
    return this.selectableUsers.filter((u) => u.selected);
  }
  async createGroup(): Promise<void> {
    const name = this.newGroupName.trim();

    if (!name) {
      this.createGroupError = 'Please enter a group name';
    }

    if (name.length > 100) {
      this.createGroupError = 'Group name must be under 100 chararcters';
    }
    if (this.selectedMembers.length === 0) {
      this.createGroupError = 'Please select at least one member';
    }
    this.isCreatingGroup = true;
    this.createGroupError = '';
    try {
      await this.signalR.createGroup(name);

      const { firstValueFrom } = await import('rxjs');
      const { filter, take } = await import('rxjs/operators');

      const newGroup = await firstValueFrom(
        this.signalR.onGroupCreated.pipe(
          filter((g) => g.name === name),
          take(1),
        ),
      );

      const memberIds = this.selectedMembers.map((i) => i.userId);
      await this.signalR.addMembers(newGroup.id, memberIds);

      this.showCreateGroupModal = false;

      const newSidebarItem = this.sidebarItems.find(
        (i) => i.type === 'group' && i.groupId === newGroup.id,
      );
      if (newSidebarItem) {
        this.selectItem(newSidebarItem);
      }
    } catch (err) {
      ('Failed to create group. Please try again.');
    } finally {
      this.isCreatingGroup = false;
    }
  }

  openAddMembersModal(): void {
    if (!this.selectedItem || this.selectedItem.type !== 'group') {
      return;
    }

    const groupId = this.selectedItem.groupId;
    if (!groupId) return;

    this.addMembersGroupId = groupId;
    this.addMembersGroupName = this.selectedItem.name;
    this.memberSearchQuery = '';
    this.addMembersError = '';
    this.isAddingMembers = false;

    this.chatService.getGroupsMembers(groupId).subscribe({
      next: (existingMemberIds) => {
        this.selectableUsers = this.conversations
          .filter(
            (c) =>
              !existingMemberIds.some((member) => member.userId === c.userId),
          )
          .map((c) => ({
            userId: c.userId,
            username: c.username,
            isOnline: c.isOnline,
            selected: false,
          }));

        this.filteredSelectableUsers = [...this.selectableUsers];
        this.showAddMembersModal = true;
      },
      error: () => {
        this.errorMessage = 'Failed to load group members';
      },
    });
  }

  async addMembersToGroup(): Promise<void> {
    if (!this.addMembersGroupId) return;

    if (this.selectedMembers.length === 0) {
      this.addMembersError = 'Please select at least one person';
      return;
    }

    this.isAddingMembers = true;
    this.addMembersError = '';

    try {
      const membersIds = this.selectedMembers.map((u) => u.userId);

      await this.signalR.addMembers(this.addMembersGroupId, membersIds);

      const groupItem = this.sidebarItems.find(
        (i) => i.type === 'group' && i.groupId === this.addMembersGroupId,
      );

      if (groupItem && groupItem.memberCount !== null) {
        groupItem.memberCount += membersIds.length;

        if (this.selectedItem?.id === groupItem.id) {
          this.selectedItem = { ...groupItem };
        }
      }

      const group = this.groups.find((g) => g.id === this.addMembersGroupId);
      if (group) {
        group.memberCount = (group.memberCount || 0) + membersIds.length;
      }
      this.showAddMembersModal = false;

      const addedNames = this.selectedMembers.map((u) => u.username).join(',');
    } catch {
      this.addMembersError = 'Failed to add members. Please try again.';
    } finally {
      this.isAddingMembers = false;
    }
  }

  openGroupInfoPanel(): void {
    if (!this.selectedItem || this.selectedItem.type !== 'group') {
      return;
    }

    const groupId = this.selectedItem.groupId;
    if (!groupId) return;

    this.isLoadingMembers = true;
    this.showGroupInfoPanel = true;

    this.chatService.getGroupsMembers(groupId).subscribe({
      next: (members) => {
        this.groupMembers = members;

        const currentUserMember = members.find(
          (m) => m.userId === this.currentUserId,
        );

        this.currentUserIsAdmin = currentUserMember?.isAdmin ?? false;

        this.isLoadingMembers = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load members';
        this.isLoadingMembers = false;
      },
    });
  }

  async leaveGroup(): Promise<void> {
    if (!this.selectedItem || this.selectedItem.type !== 'group') {
      return;
    }

    const groupId = this.selectedItem?.groupId;
    if (!groupId) return;

    this.dialog.confirm({
      variant: 'danger',
      title: 'Leave Group',
      message: `Leave "${this.selectedItem.name}"?\n\nYou will no longer receive messages from this group.`,
      confirmText: 'Leave',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await this.signalR.leaveGroup(groupId);
        } catch {
          this.errorMessage = 'Failed to leave group';
        }
      },
    });
  }
  async removeMember(member: GroupMemberDetail): Promise<void> {
    if (!this.selectedItem || this.selectedItem.type !== 'group') {
      return;
    }

    const groupId = this.selectedItem.groupId;
    if (!groupId) return;

    const confirmed = confirm(`Remove ${member.username} from the group?`);

    if (!confirmed) return;

    try {
      await this.signalR.removeMember(groupId, member.userId);
    } catch {
      this.errorMessage = 'Failed to remove member';
    }
  }

  async deleteGroup(): Promise<void> {
    if (!this.selectedItem || this.selectedItem.type !== 'group') {
      return;
    }

    const groupId = this.selectedItem.groupId;
    if (!groupId) return;
    const confirmed = confirm(
      `⚠️ DELETE "${this.selectedItem.name}"?\n\n` +
        `This will:\n` +
        `• Remove ALL members\n` +
        `• Delete ALL messages\n` +
        `• Cannot be undone\n\n` +
        `Type the group name to confirm deletion.`,
    );

    if (!confirmed) return;

    const typedName = prompt(
      `Type "${this.selectedItem.name}" to confim deletion`,
    );

    if (typedName !== this.selectedItem.name) {
      alert('❌ Group name did not match. Deletion cancelled.');
      return;
    }

    try {
      await this.signalR.deleteGroup(groupId);

      //
      // Wait for GroupDeleted event
      // which will remove from sidebar and close panel
      //
    } catch {
      this.errorMessage = 'Failed to delete group';
    }
  }

  toggleSearchBox(): void {
    debugger;
    this.showSearchBox = !this.showSearchBox;

    if (!this.showSearchBox) {
      this.clearSearch();
    } else {
      setTimeout(() => {
        const input = document.querySelector(
          '.search-input',
        ) as HTMLInputElement;
        input?.focus;
      }, 100);
    }
  }

  onSearchInput(): void {
    const query = this.searchQuery.trim();
    if (query.length === 0) {
      this.searchResults = [];
      return;
    }
    if (query.length < 2) {
      return;
    }
    this.searchInput$.next(query);
  }

  private performSearch(query: string): void {
    if (!this.selectedItem) return;

    this.isSearching = true;

    let search$: Observable<SearchResult[]>;

    if (
      this.selectedItem.type === 'user' &&
      this.selectedItem.userId === this.currentUserId
    ) {
      search$ = this.chatService.searchUserMessages(
        this.selectedItem.userId,
        query,
      );
    } else if (
      this.selectedItem.type === 'group' &&
      this.selectedItem.groupId
    ) {
      search$ = this.chatService.searchGroupMessages(
        this.selectedItem.groupId,
        query,
      );
    } else {
      this.isSearching = false;
      return;
    }

    search$
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isSearching = false)),
      )
      .subscribe({
        next: (results) => {
          this.searchResults = results.map((r) => ({
            ...r,
            highlightedContent: this.highlightText(r.content, query),
          }));
        },
        error: () => {
          this.errorMessage = 'Search failed';
          this.searchResults = [];
        },
      });
  }

  private highlightText(text: string, query: string): string {
    if (!query) return text;

    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
  private escapeRegex(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  jumpToMessage(result: SearchResult): void {
    this.clearSearch();

    const msgIndex = this.messages.findIndex((m) => m.id === result.id);
    if (msgIndex !== 1) {
      setTimeout(() => {
        const el = document.querySelector(
          `[data-message-id = "${result.id}"]`,
        ) as HTMLElement;

        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });

          el.classList.add('message-highlight');

          setTimeout(() => {
            el.classList.remove('message-highlight');
          }, 2000);
        }
      }, 100);
    } else {
      this.dialog.confirm({
        variant: 'info',
        title: 'Scroll up',
        message: 'This message is in older history. Scroll up to load it.',
        confirmText: 'Ok',
      });
    }
  }

  clearSearch(): void {
    this.showSearchBox = false;
    this.searchQuery = '';
    this.searchResults = [];
    this.isSearching = false;
  }

  closeCreateGroupModal(): void {
    this.showCreateGroupModal = false;
    this.newGroupName = '';
    this.memberSearchQuery = '';
    this.createGroupError = '';

    this.selectableUsers.forEach((u) => (u.selected = false));
  }
  resetCreateGroupModal(): void {
    this.newGroupName = '';
    this.memberSearchQuery = '';
    this.createGroupError = '';
    this.isCreatingGroup = false;
  }

  closeAddMembersModal(): void {
    this.showAddMembersModal = false;
    this.addMembersGroupId = null;
    this.addMembersGroupName = '';
    this.memberSearchQuery = '';
    this.addMembersError = '';
    this.selectableUsers.forEach((u) => (u.selected = false));
  }

  closeGroupInfoPanel(): void {
    this.showGroupInfoPanel = false;
    this.groupMembers = [];
    this.currentUserIsAdmin = false;
  }
}
