import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { blockService } from '../../services/blockService';
import { useAuthStore } from '../../store/authStore';
import { Block } from '../../services/blockService';

const BlockedUsersScreen = () => {
  const [blockedUsers, setBlockedUsers] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      setLoading(true);
      const blocks = await blockService.getBlockedUsers();
      setBlockedUsers(blocks);
    } catch (error) {
      console.error('Error loading blocked users:', error);
      Alert.alert('Error', 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBlockedUsers();
    setRefreshing(false);
  };

  const handleUnblock = (blockId: string, userId: string) => {
    Alert.alert(
      'Unblock User',
      'Are you sure you want to unblock this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockService.unblockUser(userId);
              setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
              Alert.alert('Success', 'User has been unblocked');
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user');
            }
          }
        }
      ]
    );
  };

  const renderBlockedUser = ({ item }: { item: Block }) => {
    const userData = item.blocked_user;
    
    return (
      <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
        <View className="flex-1">
          <Text className="font-semibold text-lg">{userData.display_name || userData.username}</Text>
          <Text className="text-gray-500">@{userData.username}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleUnblock(item.id, userData.id)}
          className="bg-red-500 px-4 py-2 rounded-full"
        >
          <Text className="text-white font-semibold">Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center">
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
        <View className="p-4 bg-white border-b border-gray-200">
          <Text className="text-2xl font-bold">Blocked Users</Text>
          <Text className="text-gray-500 mt-1">
            {blockedUsers.length} {blockedUsers.length === 1 ? 'user' : 'users'} blocked
          </Text>
        </View>

        {blockedUsers.length === 0 ? (
          <View className="flex-1 justify-center items-center p-4">
            <Text className="text-xl text-gray-500 text-center">
              You haven't blocked any users yet
            </Text>
            <Text className="text-gray-400 text-center mt-2">
              Users you block will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            renderItem={renderBlockedUser}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default BlockedUsersScreen;