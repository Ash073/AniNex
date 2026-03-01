export interface User {
  id: string;
  _id?: string; // backward compat alias
  username: string;
  email: string;
  avatar: string;
  bio: string;
  displayName?: string;
  display_name?: string;
  name?: string;
  age?: number;
  dateOfBirth?: string;
  date_of_birth?: string;
  mobile?: string;
  gender?: string;
  favoriteAnime: string[];
  favorite_anime?: string[];
  genres: string[];
  interests: string[];
  experienceLevel: 'casual' | 'moderate' | 'hardcore';
  experience_level?: 'casual' | 'moderate' | 'hardcore';
  servers: string[];
  friends: string[];
  onboardingCompleted: boolean;
  onboarding_completed?: boolean;
  profileCompleted?: boolean;
  profile_completed?: boolean;
  isOnline: boolean;
  is_online?: boolean;
  lastSeen: Date;
  last_seen?: string;
  settings?: {
    profile_visibility?: 'public' | 'friends_only' | 'private';
    show_online_status?: boolean;
    allow_friend_requests?: boolean;
    show_activity_status?: boolean;
    allow_dm_from?: 'everyone' | 'friends_only' | 'nobody';
  };
  createdAt: Date;
  created_at?: string;
  updatedAt: Date;
  updated_at?: string;
  xp?: number;
  level?: number;
  streak?: number;
  badges?: string[];
  lastLogin?: string;
  last_login?: string;
}

export interface Server {
  id: string;
  _id?: string;
  name: string;
  description: string;
  icon: string;
  banner?: string;
  animeTheme?: string;
  anime_theme?: string;
  tags: string[];
  owner: User | string;
  owner_id?: string;
  members: ServerMember[];
  isPublic: boolean;
  is_public?: boolean;
  maxMembers: number;
  max_members?: number;
  memberCount: number;
  member_count?: number;
  messageCount: number;
  message_count?: number;
  settings?: ServerSettings;
  createdAt: Date;
  created_at?: string;
  updatedAt: Date;
  updated_at?: string;
}

export interface ServerMember {
  user: User | string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt: Date;
  joined_at?: string;
}

export interface Channel {
  id: string;
  _id?: string;
  name: string;
  description: string;
  server: string;
  server_id?: string;
  type: 'text' | 'voice' | 'announcement';
  isPublic: boolean;
  is_public?: boolean;
  allowedRoles: string[];
  allowed_roles?: string[];
  position: number;
  messageCount: number;
  message_count?: number;
  lastMessageAt?: Date;
  last_message_at?: string;
  createdAt: Date;
  created_at?: string;
  updatedAt: Date;
  updated_at?: string;
}

export interface Message {
  id: string;
  _id?: string;
  content: string;
  author: User;
  author_id?: string;
  channel: string;
  channel_id?: string;
  server: string;
  server_id?: string;
  type: 'text' | 'system' | 'announcement';
  attachments: Attachment[];
  readBy: ReadReceipt[];
  read_by?: any[];
  edited: boolean;
  is_edited?: boolean;
  is_deleted?: boolean;
  status?: 'sent' | 'delivered' | 'seen';
  replied_to_id?: string;
  replied_to_message?: Message;
  reactions?: string[];
  editedAt?: Date;
  createdAt: Date;
  created_at?: string;
  updatedAt: Date;
  updated_at?: string;
}

export interface Attachment {
  url: string;
  type: string;
  size: number;
}

export interface ReadReceipt {
  user: string;
  readAt: Date;
}

export interface Post {
  id: string;
  _id?: string;
  content: string;
  title?: string;
  author: User;
  author_id?: string;
  server?: Server;
  server_id?: string;
  category: 'discussion' | 'review' | 'recommendation' | 'fan-art' | 'meme' | 'question' | 'announcement';
  tags: string[];
  images: string[];
  likes: string[];
  likeCount: number;
  like_count?: number;
  liked_by_me?: boolean;
  commentCount: number;
  comment_count?: number;
  isPublic: boolean;
  is_public?: boolean;
  isPinned: boolean;
  is_pinned?: boolean;
  viewCount?: number;
  // Privacy controls
  visibility?: 'public' | 'followers' | 'selected';
  allowedUsers?: string[];
  // Comment controls
  commentsEnabled?: boolean;
  // Mentions
  mentions?: string[];
  createdAt: Date;
  created_at?: string;
  updatedAt: Date;
  updated_at?: string;
}

export interface Comment {
  id: string;
  _id?: string;
  content: string;
  author: User;
  author_id?: string;
  post: string;
  post_id?: string;
  parentComment?: string;
  parent_comment_id?: string;
  likes: string[];
  likeCount: number;
  like_count?: number;
  createdAt: Date;
  created_at?: string;
  updatedAt: Date;
  updated_at?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    refreshToken: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

// ─── Direct Messages ───
export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_text?: string;
  last_message_at?: string;
  created_at?: string;
  updated_at?: string;
  otherUser?: {
    id: string;
    username: string;
    avatar: string;
    display_name?: string;
    is_online?: boolean;
    last_seen?: string;
  };
  unreadCount?: number;
  isBlocked?: boolean;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url?: string;
  is_read: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  status?: 'sent' | 'delivered' | 'seen';
  replied_to_id?: string;
  replied_to_message?: DirectMessage;
  reactions?: string[];
  created_at: string;
  updated_at?: string;
  sender?: {
    id: string;
    username: string;
    avatar: string;
    display_name?: string;
    is_online?: boolean;
  };
}

// ─── Friend Requests ───
export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at?: string;
  sender?: {
    id: string;
    username: string;
    avatar: string;
    display_name?: string;
    bio?: string;
    is_online?: boolean;
  };
  receiver?: {
    id: string;
    username: string;
    avatar: string;
    display_name?: string;
    bio?: string;
    is_online?: boolean;
  };
}

// ─── Server Settings / Permissions ───
export interface ServerSettings {
  allow_member_chat: boolean;
  allow_member_post: boolean;
  allow_member_invite: boolean;
}
