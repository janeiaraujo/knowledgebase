import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Spinner, Alert } from 'react-bootstrap';
import { commentAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

function Comment({ comment, onReply, onDelete, onEdit, currentUserId, userRole }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const isAuthor = comment.author._id === currentUserId;
  const canDelete = isAuthor || ['owner', 'admin'].includes(userRole);
  
  const formatDate = (date) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const handleEdit = async () => {
    if (!editContent.trim()) return;
    
    setSubmitting(true);
    try {
      await onEdit(comment._id, editContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to edit comment:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleReply = async () => {
    if (!replyContent.trim()) return;
    
    setSubmitting(true);
    try {
      await onReply(comment._id, replyContent);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (error) {
      console.error('Failed to reply:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="comment mb-3">
      <div className="d-flex gap-3">
        <div 
          className="avatar bg-primary text-white rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: '36px', height: '36px', fontSize: '14px' }}
        >
          {comment.author.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        
        <div className="flex-grow-1">
          <div className="d-flex justify-content-between align-items-start mb-1">
            <div>
              <strong className="me-2">{comment.author.name}</strong>
              <small className="text-muted">{formatDate(comment.created_at)}</small>
              {comment.updated_at !== comment.created_at && (
                <small className="text-muted ms-1">(editado)</small>
              )}
            </div>
            
            <div className="d-flex gap-1">
              {isAuthor && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="p-0 text-muted"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <i className="bi bi-pencil"></i>
                </Button>
              )}
              {canDelete && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="p-0 text-muted"
                  onClick={() => {
                    if (window.confirm('Tem certeza que deseja excluir este comentário?')) {
                      onDelete(comment._id);
                    }
                  }}
                >
                  <i className="bi bi-trash"></i>
                </Button>
              )}
            </div>
          </div>
          
          {isEditing ? (
            <div className="mb-2">
              <Form.Control
                as="textarea"
                rows={2}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="mb-2"
              />
              <div className="d-flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleEdit}
                  disabled={submitting}
                >
                  {submitting ? <Spinner size="sm" /> : 'Salvar'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline-secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <p className="mb-2" style={{ whiteSpace: 'pre-wrap' }}>{comment.content}</p>
          )}
          
          {!isEditing && (
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 text-muted"
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <i className="bi bi-reply me-1"></i>Responder
            </Button>
          )}
          
          {showReplyForm && (
            <div className="mt-2 mb-3">
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Escreva sua resposta..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="mb-2"
              />
              <div className="d-flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleReply}
                  disabled={submitting || !replyContent.trim()}
                >
                  {submitting ? <Spinner size="sm" /> : 'Responder'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline-secondary"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          
          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="replies ms-0 mt-3 ps-3 border-start">
              {comment.replies.map(reply => (
                <Comment
                  key={reply._id}
                  comment={reply}
                  onReply={onReply}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  currentUserId={currentUserId}
                  userRole={userRole}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KBComments({ recordId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    fetchComments();
  }, [recordId]);
  
  const fetchComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await commentAPI.list(recordId);
      setComments(data.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      setError('Falha ao carregar comentários');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      const { data } = await commentAPI.create(recordId, { content: newComment });
      setComments([...comments, data.comment]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to create comment:', error);
      setError('Falha ao criar comentário');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleReply = async (parentId, content) => {
    const { data } = await commentAPI.create(recordId, { 
      content, 
      parent_id: parentId 
    });
    
    // Add reply to the parent comment
    const updateComments = (items) => {
      return items.map(comment => {
        if (comment._id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), data.comment]
          };
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: updateComments(comment.replies)
          };
        }
        return comment;
      });
    };
    
    setComments(updateComments(comments));
  };
  
  const handleDelete = async (commentId) => {
    try {
      await commentAPI.delete(commentId);
      
      // Remove comment from state
      const removeComment = (items) => {
        return items.filter(comment => {
          if (comment._id === commentId) return false;
          if (comment.replies) {
            comment.replies = removeComment(comment.replies);
          }
          return true;
        });
      };
      
      setComments(removeComment(comments));
    } catch (error) {
      console.error('Failed to delete comment:', error);
      setError('Falha ao excluir comentário');
    }
  };
  
  const handleEdit = async (commentId, content) => {
    await commentAPI.update(commentId, { content });
    
    // Update comment in state
    const updateComments = (items) => {
      return items.map(comment => {
        if (comment._id === commentId) {
          return { ...comment, content, updated_at: new Date().toISOString() };
        }
        if (comment.replies) {
          return { ...comment, replies: updateComments(comment.replies) };
        }
        return comment;
      });
    };
    
    setComments(updateComments(comments));
  };
  
  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }
  
  return (
    <div className="kb-comments">
      <h5 className="mb-3">
        <i className="bi bi-chat-dots me-2"></i>
        Comentários ({comments.length})
      </h5>
      
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* New comment form */}
      <Form onSubmit={handleSubmit} className="mb-4">
        <Form.Group className="mb-2">
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="Adicione um comentário..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
        </Form.Group>
        <Button 
          type="submit" 
          disabled={submitting || !newComment.trim()}
        >
          {submitting ? (
            <>
              <Spinner size="sm" className="me-2" />
              Enviando...
            </>
          ) : (
            <>
              <i className="bi bi-send me-2"></i>
              Comentar
            </>
          )}
        </Button>
      </Form>
      
      {/* Comments list */}
      {comments.length > 0 ? (
        <div className="comments-list">
          {comments.map(comment => (
            <Comment
              key={comment._id}
              comment={comment}
              onReply={handleReply}
              onDelete={handleDelete}
              onEdit={handleEdit}
              currentUserId={user?._id}
              userRole={user?.role}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted">
          <i className="bi bi-chat-dots fs-1 d-block mb-2"></i>
          <p className="mb-0">Nenhum comentário ainda. Seja o primeiro a comentar!</p>
        </div>
      )}
    </div>
  );
}
