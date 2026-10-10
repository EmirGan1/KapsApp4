import React, { useState } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Trash2, 
  Maximize2, 
  Send
} from 'lucide-react';
import Avatar from './Avatar';
import MultiMediaPostViewer from './MultiMediaPostViewer';
import AdminModerationMenu from './AdminModerationMenu';
import { Post, Comment } from '../types';

interface PostCardProps {
  post: Post;
  currentUserId: number;
  currentUsername: string;
  activeSubject?: string | null;
  isCommentsOpen?: boolean;
  comments?: Comment[];
  onLike: (postId: number) => void;
  onOpenLikes: (postId: number, count: number) => void;
  onToggleComments: (postId: number) => void;
  onOpenModal: (post: any, index: number) => void;
  onDeletePost: (postId: number) => void;
  onUserClick?: (userId: number) => void;
  onCommentSubmit?: (postId: number, content: string) => void;
  onDeleteComment?: (commentId: number, postId: number) => void;
  onModerationSuccess?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  currentUsername,
  activeSubject,
  isCommentsOpen = false,
  comments = [],
  onLike,
  onOpenLikes,
  onToggleComments,
  onOpenModal,
  onDeletePost,
  onUserClick,
  onCommentSubmit,
  onDeleteComment,
  onModerationSuccess
}) => {
  const [commentInput, setCommentInput] = useState<string>('');

  const isEmirgan = currentUsername?.trim().toLowerCase() === 'emirgan';
  const isPostAuthor = Number(post.user_id) === Number(currentUserId);
  const canDelete = isPostAuthor || isEmirgan;

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !onCommentSubmit) return;
    onCommentSubmit(post.id, commentInput.trim());
    setCommentInput('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-y md:border border-slate-100 dark:border-slate-800 md:rounded-2xl shadow-sm overflow-hidden transition-colors duration-200">
      {/* Post Header */}
      <div className="p-4 flex items-center gap-3">
        <div
          className="cursor-pointer"
          onClick={() => onUserClick && onUserClick(post.user_id)}
        >
          <Avatar url={post.avatar || undefined} name={post.username} color={post.color || undefined} size={10} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="font-bold text-slate-800 dark:text-slate-200 text-[15px] leading-tight cursor-pointer hover:underline truncate"
              onClick={() => onUserClick && onUserClick(post.user_id)}
            >
              {post.username}
            </h3>
            {post.subject && !activeSubject && (
              <span className="text-[11px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium rounded-full truncate">
                #{post.subject}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {new Date(post.created_at).toLocaleString("tr-TR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Emirgan Moderation Menu */}
          {isEmirgan && post.username?.trim().toLowerCase() !== 'emirgan' && (
            <AdminModerationMenu
              targetUserId={post.user_id}
              targetUsername={post.username}
              currentUsername={currentUsername}
              variant="dots"
              onSuccess={() => onModerationSuccess?.()}
            />
          )}

          {/* Gönderi Silme Butonu */}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDeletePost(post.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900/50 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              title={isEmirgan && !isPostAuthor ? "Yönetici Olarak Sil (emirgan)" : "Gönderiyi Sil"}
            >
              <Trash2 size={15} className="shrink-0" />
              <span className="hidden sm:inline">Gönderiyi Sil</span>
            </button>
          )}
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="px-4 pb-3 text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed whitespace-pre-wrap">
          {post.caption}
        </p>
      )}

      {/* MultiMediaPostViewer: Displays single or multiple photos, videos, and files */}
      <MultiMediaPostViewer
        post={post}
        onOpenModal={(p, idx) => onOpenModal(p, idx ?? 0)}
      />

      {/* Action Bar */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center gap-4 sm:gap-6">
          
          {/* Beğeni Grubu: Kalp İkonu (Beğen) + Beğeni Sayacı (Beğenenler Listesini Aç) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onLike(post.id)}
              aria-label={post.is_liked ? "Beğenmekten vazgeç" : "Beğen"}
              className={`p-1 rounded-lg transition-transform active:scale-125 cursor-pointer ${
                post.is_liked ? "text-rose-500" : "text-slate-500 dark:text-slate-400 hover:text-rose-500"
              }`}
            >
              <Heart
                size={22}
                fill={post.is_liked ? "currentColor" : "none"}
              />
            </button>
            <button
              type="button"
              onClick={() => onOpenLikes(post.id, post.likes_count)}
              title="Beğenenleri Gör"
              className={`font-semibold text-sm px-1.5 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none ${
                post.is_liked ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {post.likes_count}
              <span className="hidden sm:inline text-xs font-normal text-slate-400 ml-1">beğeni</span>
            </button>
          </div>

          {/* Yorum Butonu */}
          <button
            type="button"
            onClick={() => onToggleComments(post.id)}
            className={`flex items-center gap-2 transition-colors cursor-pointer ${
              isCommentsOpen
                ? "text-blue-500"
                : "text-slate-500 dark:text-slate-400 hover:text-blue-500"
            }`}
          >
            <MessageCircle size={22} />
            <span className="font-medium text-sm">
              {post.comments_count !== undefined ? post.comments_count : "Yorum"}
            </span>
          </button>
        </div>

        {(post.image || (post.attachments && (Array.isArray(post.attachments) ? post.attachments.length > 0 : true))) && (
          <button
            type="button"
            onClick={() => onOpenModal(post, 0)}
            className="text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Maximize2 size={14} />
            <span>Detaylar</span>
          </button>
        )}
      </div>

      {/* Comments Section */}
      {isCommentsOpen && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-b-2xl transition-colors duration-200">
          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto scrollbar-thin">
            {comments.length === 0 ? (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-2">
                Henüz yorum yok. İlk yorumu sen yap!
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div
                    className="cursor-pointer"
                    onClick={() => onUserClick && onUserClick(c.user_id)}
                  >
                    <Avatar url={c.avatar || undefined} name={c.username} color={c.color || undefined} size={6} />
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-xs border border-slate-100 dark:border-slate-700 flex-1 transition-colors duration-200 group relative">
                    <div className="flex items-center justify-between">
                      <div
                        className="font-semibold text-xs text-slate-800 dark:text-slate-200 cursor-pointer hover:underline inline-block"
                        onClick={() => onUserClick && onUserClick(c.user_id)}
                      >
                        {c.username}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.created_at).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {(Number(c.user_id) === Number(currentUserId) || isEmirgan) && onDeleteComment && (
                          <button
                            type="button"
                            onClick={() => onDeleteComment(c.id, post.id)}
                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded cursor-pointer"
                            title="Yorumu Sil"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New Comment Input */}
          {onCommentSubmit && (
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Yorum yaz..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Send size={14} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default PostCard;
