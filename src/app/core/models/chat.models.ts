// src/app/core/models/chat.models.ts

// ═══════════════════════════════════════════
// 👥 Conversation (Sidebar Item)
// ═══════════════════════════════════════════
export interface Conversation {
  userId: number;
  username: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isOnline: boolean;
  isTyping: boolean; // ✅ NEW — typing indicator
  lastSeenAt: string | null;
}

// ═══════════════════════════════════════════
// 💬 Message (Chat Bubble)
// ═══════════════════════════════════════════
export interface Message {
  id?: number;
  senderId: number;
  receiverId: number;
  content: string;
  sentAt: string;
  isMine?: boolean;
  isRead?: boolean; // ✅ NEW — read receipt
  status?: MessageStatus; // ✅ NEW — delivery tracking

  showDateSeparator?: boolean;
  dateSeparatorLabel?: string;

  senderName?: string;
  groupId?: number;
}

// ═══════════════════════════════════════════
// 📡 SignalR Incoming Message
// ═══════════════════════════════════════════
export interface IncomingMessage {
  senderId: number;
  content: string;
  sentAt: string;
}

// ═══════════════════════════════════════════
// 📡 Read Receipt from Hub
// ═══════════════════════════════════════════
export interface ReadReceipt {
  readByUserId: number;
  timestamp: string;
}
export interface LastSeenEvent {
  userId: number;
  lastSeenAt: string;
}

//unified Sidebar Item
export interface SidebarItem {
  id: string;
  type: 'user' | 'group';
  name: string;
  userId: number | null; // for user : other person Id
  groupId: number | null; //for user : not used(null)
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isOnline: boolean; //only for type=user
  isTyping: boolean;
  lastSeenAt: string | null;
  memberCount: number | null;
}

//Create Group Request
export interface CreateGroupRequest {
  name: string;
  memberIds: number[];
}

//selectable user
export interface SelectableUser {
  userId: number;
  username: string;
  isOnline: boolean;
  selected: boolean;
}

export interface GroupMemberDetail {
  userId: number;
  username: string;
  isOnline: boolean;
  isAdmin: boolean;
  joinedAt: string;
  lastSeenAt: string | null;
}

export interface SearchResult {
  id: number;
  senderId: number;
  senderName: number;
  content: string;
  sentAt: string;

  highlightedContent?: string;
}

// ═══════════════════════════════════════════
// 🔌 Connection State
// ═══════════════════════════════════════════
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

// ═══════════════════════════════════════════
// 📬 Message Delivery Status
// ═══════════════════════════════════════════
export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

// ═══════════════════════════════════════════
// 🏷️ Hub Event Names (mirrors C# HubEvents)
// ═══════════════════════════════════════════
export const HubEvents = {
  // Server → Client
  UserOnline: 'UserOnline',
  UserOffline: 'UserOffline',
  ReceiveMessage: 'ReceiveMessage',
  UserTyping: 'UserTyping',
  UserStoppedTyping: 'UserStoppedTyping',
  MessageRead: 'MessageRead',
  GroupCreated: 'GroupCreated',
  ReceiveGroupMessage: 'ReceiveGroupMessage',
  Error: 'Error',
  userLastSeen: 'UserLastSeen',
  LeftGroup: 'LeftGroup',
  MemberLeftGroup: 'MemberLeftGroup',
  RemovedFromGroup: 'RemovedFromGroup',
  LeaveGroupAsync: 'LeaveGroupAsync',
  RemoveMemberAsync: 'RemoveMemberAsync',
  GroupDeleted: 'GroupDeleted',
  DeleteGroupAsync: 'DeleteGroupAsync',

  // Client → Server (hub method names)
  SendMessage: 'SendMessage',
  Typing: 'Typing',
  StopTyping: 'StopTyping',
  MarkAsRead: 'MarkAsRead',
  CreateGroupAsync: 'CreateGroupAsync',
  SendGroupMessage: 'SendGroupMessage',
  AddedToGroup: 'AddedToGroup',
  AddedMembersAsync: 'AddMembersAsync',
} as const;
