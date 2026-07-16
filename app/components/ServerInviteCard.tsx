import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { serverService } from '@/services/serverService';
import { Server } from '@/types';

interface Props {
  serverId: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ServerInviteCard({ serverId }: Props) {
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    serverService
      .getServer(serverId)
      .then((s) => {
        if (!cancelled) setServer(s);
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const handleJoin = async () => {
    if (!server) return;
    const sid = server._id || server.id;
    setJoining(true);
    try {
      await serverService.joinServer(sid);
      router.push({ pathname: '/(modals)/server/[id]', params: { id: sid } });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to join server';
      if (msg.toLowerCase().includes('already')) {
        router.push({ pathname: '/(modals)/server/[id]', params: { id: sid } });
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator size="small" color="#6366f1" />
      </View>
    );
  }

  if (!server) {
    return (
      <View style={[styles.card, styles.center]}>
        <Ionicons name="alert-circle-outline" size={24} color="rgba(255,255,255,0.3)" />
        <Text style={styles.errorText}>Invite invalid or expired</Text>
      </View>
    );
  }

  const memberCount = server.member_count ?? server.memberCount ?? server.members?.length ?? 0;
  const iconUri = server.icon?.startsWith('http') ? server.icon : null;
  const bannerUri = server.banner?.startsWith('http') ? server.banner : null;

  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.95} onPress={handleJoin} style={styles.touchable}>
        {/* Banner Section */}
        <View style={styles.bannerContainer}>
          {bannerUri ? (
            <Image source={{ uri: bannerUri }} style={styles.banner} />
          ) : (
            <LinearGradient
              colors={['#4f46e5', '#312e81']}
              style={styles.banner}
            />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(15,15,30,1)']}
            style={styles.bannerGradient}
          />
        </View>

        {/* Floating Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconOutline}>
            {iconUri ? (
              <Image source={{ uri: iconUri }} style={styles.icon} />
            ) : (
              <View style={[styles.icon, styles.iconFallback]}>
                <Ionicons name="server" size={24} color="#6366f1" />
              </View>
            )}
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.infoSection}>
          <Text style={styles.serverName} numberOfLines={1}>
            {server.name}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.onlineDot} />
              <Text style={styles.statText}>{memberCount} Members</Text>
            </View>
          </View>

          {server.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {server.description}
            </Text>
          ) : (
            <Text style={styles.description}>Join our community to chat and connect!</Text>
          )}

          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.joinButtonText}>Join Community</Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Helpers ──
const SERVER_TAG_REGEX = /\[server:([a-zA-Z0-9_-]+)\]/;

export function extractServerInviteId(content: string): string | null {
  const match = content.match(SERVER_TAG_REGEX);
  return match ? match[1] : null;
}

export function stripServerInviteText(content: string): string {
  // Removes "🏯 Server Invite: ... [server:ID]"
  return content
    .replace(/🏯\s*Server Invite:.*?\[server:[a-zA-Z0-9_-]+\]/si, '')
    .trim();
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    backgroundColor: '#0f0f1e',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginVertical: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  center: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchable: {
    width: '100%',
  },
  bannerContainer: {
    height: 100,
    width: '100%',
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: -35,
    zIndex: 10,
  },
  iconOutline: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#0f0f1e',
    padding: 4,
  },
  icon: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    padding: 16,
    paddingTop: 8,
    alignItems: 'center',
  },
  serverName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  statText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  joinButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    gap: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});
