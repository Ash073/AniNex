import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { blockService } from '@/services/blockService';
import { useAuthStore } from '@/store/authStore';

interface BlockUserModalProps {
  visible: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUsername: string;
  targetAvatar?: string;
  onBlockChange?: (isBlocked: boolean) => void;
}

const BlockUserModal: React.FC<BlockUserModalProps> = ({
  visible,
  onClose,
  targetUserId,
  targetUsername,
  targetAvatar,
  onBlockChange,
}) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const loadBlockStatus = async () => {
    try {
      setLoading(true);
      const blockStatus = await blockService.checkIfBlocked(targetUserId);
      setIsBlocked(blockStatus.isBlocked);
    } catch (error) {
      console.error('Error checking block status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockToggle = async () => {
    if (isBlocked) {
      // Confirm unblock
      Alert.alert(
        'Unblock User',
        `Are you sure you want to unblock ${targetUsername}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            style: 'default',
            onPress: unblockUser
          }
        ]
      );
    } else {
      // Confirm block
      Alert.alert(
        'Block User',
        `Are you sure you want to block ${targetUsername}? They won't be able to:\n\n• Message you\n• Add you as friend\n• Mention you\n• View your profile\n• See your posts\n• Comment on your posts\n\nThis action can be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: blockUser
          }
        ]
      );
    }
  };

  const blockUser = async () => {
    try {
      setLoading(true);
      await blockService.blockUser(targetUserId);
      setIsBlocked(true);
      onBlockChange?.(true);
      Alert.alert('Success', `${targetUsername} has been blocked`);
    } catch (error: any) {
      console.error('Error blocking user:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to block user');
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async () => {
    try {
      setLoading(true);
      await blockService.unblockUser(targetUserId);
      setIsBlocked(false);
      onBlockChange?.(false);
      Alert.alert('Success', `${targetUsername} has been unblocked`);
    } catch (error: any) {
      console.error('Error unblocking user:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to unblock user');
    } finally {
      setLoading(false);
    }
  };

  // Load block status when modal opens
  React.useEffect(() => {
    if (visible && user) {
      loadBlockStatus();
    }
  }, [visible, targetUserId, user]);

  if (!user || user.id === targetUserId) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>User Actions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* User Info */}
          <View style={styles.userInfo}>
            {targetAvatar ? (
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {targetUsername.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={24} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <Text style={styles.username}>@{targetUsername}</Text>
          </View>

          {/* Block Status Indicator */}
          {isBlocked && (
            <View style={styles.blockedIndicator}>
              <Ionicons name="ban" size={16} color="#ef4444" />
              <Text style={styles.blockedText}>Blocked</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, isBlocked ? styles.unblockButton : styles.blockButton]}
              onPress={handleBlockToggle}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={isBlocked ? "#ef4444" : "#fff"} size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons 
                    name={isBlocked ? "ban-outline" : "ban"} 
                    size={20} 
                    color={isBlocked ? "#ef4444" : "#fff"} 
                  />
                  <Text style={[styles.buttonText, isBlocked ? styles.unblockText : styles.blockText]}>
                    {isBlocked ? 'Unblock User' : 'Block User'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => {
                // Open report modal
                onClose();
                // TODO: Implement report functionality
                Alert.alert('Report User', 'Report functionality coming soon');
              }}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="warning-outline" size={20} color="#f59e0b" />
                <Text style={styles.reportText}>Report User</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Block Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>
              {isBlocked ? 'User is Blocked' : 'Block User'}
            </Text>
            <Text style={styles.descriptionText}>
              {isBlocked
                ? `You have blocked ${targetUsername}. They cannot interact with you in any way.`
                : `Blocking ${targetUsername} will prevent them from messaging, friending, mentioning, or viewing your content.`
              }
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'rgba(30,30,46,0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  avatarText: {
    color: '#6366f1',
    fontSize: 24,
    fontWeight: '700',
  },
  username: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  blockedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 20,
  },
  blockedText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionsContainer: {
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  blockButton: {
    backgroundColor: '#ef4444',
  },
  unblockButton: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  reportButton: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  blockText: {
    color: '#fff',
  },
  unblockText: {
    color: '#ef4444',
  },
  reportText: {
    color: '#f59e0b',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  descriptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  descriptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default BlockUserModal;