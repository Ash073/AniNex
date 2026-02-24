import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ImageBackground, RefreshControl, TextInput, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { serverService } from '@/services/serverService';
import { Server } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ServersScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuthStore();
  const userId = user?.id || user?._id;

  const { data: servers = [], isLoading, refetch } = useQuery({
    queryKey: ['servers'],
    queryFn: serverService.getServers,
    // Keep data warm so navigating back to this tab feels instant
    staleTime: 30_000, // 30s before considering data "stale"
    cacheTime: 5 * 60_000, // keep in cache for 5 minutes
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const myServers = servers.filter(s => {
    // Use is_member flag from backend (most reliable)
    if (s.is_member) return true;
    // Fallback: Check members array if present
    if (s.members && Array.isArray(s.members)) {
      return s.members.some(m => {
        const mUserId = typeof m.user === 'string' ? m.user : (m.user?.id || m.user?._id);
        return mUserId === userId;
      });
    }
    // Fallback: Check owner
    const ownerId = typeof s.owner === 'string' ? s.owner : (s.owner?.id || s.owner?._id || s.owner_id);
    return ownerId === userId;
  });

  const publicServers = servers.filter(s => {
    const sId = s.id || s._id;
    const isPublic = s.isPublic ?? s.is_public;
    return isPublic && !myServers.some(ms => (ms.id || ms._id) === sId);
  });

  // Filter by search query (local)
  const filterBySearch = (list: Server[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.animeTheme || s.anime_theme || '').toLowerCase().includes(q) ||
      (s.tags || []).some(t => t.toLowerCase().includes(q))
    );
  };

  const filteredMyServers = filterBySearch(myServers);
  const filteredPublicServers = filterBySearch(publicServers);

  const renderServer = (item: Server) => {
    const sId = item.id || item._id;
    const isMember = myServers.some(s => (s.id || s._id) === sId);
    const memberCount = item.memberCount ?? item.member_count ?? 0;
    const iconUri = item.icon;
    const hasIcon = !!iconUri && !iconUri.includes('dicebear');

    return (
      <TouchableOpacity
        key={sId}
        onPress={() => router.push(`/(modals)/server/${sId}`)}
        style={sv.card}
        activeOpacity={0.85}
      >
        {/* Blurred background image */}
        {hasIcon ? (
          <Image
            source={{ uri: iconUri }}
            style={sv.bgImage}
            blurRadius={Platform.OS === 'ios' ? 30 : 18}
            resizeMode="cover"
          />
        ) : (
          <View style={[sv.bgImage, { backgroundColor: '#1e1b4b' }]} />
        )}
        {/* Dark gradient overlay */}
        <View style={sv.cardOverlay} />

        {/* Card content */}
        <View style={sv.cardContent}>
          {/* Top row: sharp icon + name + badge */}
          <View style={sv.cardTopRow}>
            {hasIcon ? (
              <Image source={{ uri: iconUri }} style={sv.sharpIcon} />
            ) : (
              <View style={[sv.sharpIcon, sv.iconPlaceholder]}>
                <Ionicons name="server" size={20} color="#818cf8" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={sv.serverName} numberOfLines={1}>{item.name}</Text>
                {isMember && (
                  <View style={sv.joinedBadge}>
                    <Text style={sv.joinedText}>Joined</Text>
                  </View>
                )}
              </View>
              <Text style={sv.serverDesc} numberOfLines={2}>{item.description || 'No description'}</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={sv.statsRow}>
            <View style={sv.statItem}>
              <Ionicons name="people" size={13} color="rgba(255,255,255,0.55)" />
              <Text style={sv.statText}>{memberCount} members</Text>
            </View>
            {(item.animeTheme || item.anime_theme) ? (
              <View style={sv.statItem}>
                <Ionicons name="star" size={13} color="#f472b6" />
                <Text style={{ color: '#f472b6', fontWeight: '600', fontSize: 12 }}>{item.animeTheme || item.anime_theme}</Text>
              </View>
            ) : null}
          </View>

          {/* Tags */}
          {(item.tags?.length ?? 0) > 0 && (
            <View style={sv.tagsRow}>
              {item.tags.slice(0, 3).map(tag => (
                <View key={tag} style={sv.tag}>
                  <Text style={sv.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (title: string, data: Server[]) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={sv.sectionTitle}>{title}</Text>
      {data.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Ionicons name="server-outline" size={44} color="rgba(255,255,255,0.12)" />
          <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8, fontSize: 14 }}>
            {title === 'My Servers'
              ? (searchQuery.trim() ? 'No matching servers' : 'Join or create your first server!')
              : (searchQuery.trim() ? 'No matching servers' : 'No public servers available yet')}
          </Text>
        </View>
      ) : (
        data.map(server => renderServer(server))
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a14' }}>
      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>Servers</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(modals)/create-server')}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={24} color="#6366f1" />
              </TouchableOpacity>
            </View>

            {/* Create Server Banner */}
            <TouchableOpacity
              onPress={() => router.push('/(modals)/create-server')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(99,102,241,0.12)',
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(99,102,241,0.25)',
                gap: 12,
              }}
              activeOpacity={0.7}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create a Server</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>Start your own anime community</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>

            {/* Search Bar */}
            <View style={sv.searchBar}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.35)" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search servers..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={sv.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.35)" />
                </TouchableOpacity>
              )}
            </View>

            {renderSection('My Servers', filteredMyServers)}
            {renderSection('Discover Servers', filteredPublicServers)}
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </View>
  );
}

const sv = StyleSheet.create({
  card: {
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    minHeight: 130,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 20, 0.72)',
  },
  cardContent: {
    padding: 16,
    zIndex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sharpIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  iconPlaceholder: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverName: { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1, marginRight: 8 },
  serverDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 18, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  joinedBadge: { backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  joinedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    padding: 0,
  },
});