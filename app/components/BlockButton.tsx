import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, Alert, View } from 'react-native';
import { blockService } from '@/services/blockService';
import { useAuthStore } from '@/store/authStore';

interface BlockButtonProps {
  targetUserId: string;
  onBlockChange?: (isBlocked: boolean) => void;
}

const BlockButton: React.FC<BlockButtonProps> = ({ targetUserId, onBlockChange }) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      loadBlockStatus();
    }
  }, [targetUserId, user]);

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
        'Are you sure you want to unblock this user?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            style: 'destructive',
            onPress: unblockUser
          }
        ]
      );
    } else {
      // Confirm block
      Alert.alert(
        'Block User',
        'Are you sure you want to block this user? They won\'t be able to interact with you.',
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
      Alert.alert('Success', 'User has been blocked');
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
      Alert.alert('Success', 'User has been unblocked');
    } catch (error: any) {
      console.error('Error unblocking user:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to unblock user');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !user || user.id === targetUserId) {
    return null; // Don't show button for own profile or while loading
  }

  return (
    <TouchableOpacity
      onPress={handleBlockToggle}
      className={`px-4 py-2 rounded-full ${
        isBlocked 
          ? 'bg-red-100 border border-red-300' 
          : 'bg-red-500'
      }`}
      disabled={loading}
    >
      <Text className={`font-semibold ${isBlocked ? 'text-red-600' : 'text-white'}`}>
        {isBlocked ? 'Unblock' : 'Block'}
      </Text>
    </TouchableOpacity>
  );
};

export default BlockButton;