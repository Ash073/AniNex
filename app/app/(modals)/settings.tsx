import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { userService } from '@/services/userService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Visibility = 'public' | 'friends_only' | 'private';
type DmPermission = 'everyone' | 'friends_only' | 'nobody';

interface UserSettings {
  profile_visibility: Visibility;
  show_online_status: boolean;
  allow_friend_requests: boolean;
  show_activity_status: boolean;
  allow_dm_from: DmPermission;
}

const DEFAULT_SETTINGS: UserSettings = {
  profile_visibility: 'public',
  show_online_status: true,
  allow_friend_requests: true,
  show_activity_status: true,
  allow_dm_from: 'everyone',
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (user?.settings) {
      setSettings({ ...DEFAULT_SETTINGS, ...(user.settings as any) });
    }
  }, [user]);

  const update = (key: keyof UserSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedUser = await userService.updateProfile({ settings } as any);
      setUser({ ...user, settings, ...updatedUser } as any);
      setDirty(false);
      Alert.alert('Saved', 'Your settings have been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const visibilityOptions: { value: Visibility; label: string; desc: string; icon: string }[] = [
    { value: 'public', label: 'Public', desc: 'Anyone can see your profile', icon: 'globe-outline' },
    { value: 'friends_only', label: 'Friends Only', desc: 'Only friends see your info', icon: 'people-outline' },
    { value: 'private', label: 'Private', desc: 'Hide profile from everyone', icon: 'lock-closed-outline' },
  ];

  const dmOptions: { value: DmPermission; label: string; desc: string; icon: string }[] = [
    { value: 'everyone', label: 'Everyone', desc: 'Anyone can DM you', icon: 'chatbubbles-outline' },
    { value: 'friends_only', label: 'Friends Only', desc: 'Only friends can DM', icon: 'people-outline' },
    { value: 'nobody', label: 'Nobody', desc: 'Disable direct messages', icon: 'close-circle-outline' },
  ];

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Settings</Text>
        {dirty && (
          <TouchableOpacity onPress={handleSave} style={st.saveBtn} activeOpacity={0.7} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={st.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Visibility ── */}
        <Text style={st.sectionLabel}>PROFILE VISIBILITY</Text>
        <Text style={st.sectionHint}>Control who can see your profile and activity</Text>
        <View style={st.card}>
          {visibilityOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[st.optionRow, settings.profile_visibility === opt.value && st.optionRowActive]}
              onPress={() => update('profile_visibility', opt.value)}
              activeOpacity={0.7}
            >
              <View style={[st.optionIcon, settings.profile_visibility === opt.value && st.optionIconActive]}>
                <Ionicons
                  name={opt.icon as any}
                  size={20}
                  color={settings.profile_visibility === opt.value ? '#818cf8' : 'rgba(255,255,255,0.4)'}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[st.optionLabel, settings.profile_visibility === opt.value && { color: '#fff' }]}>
                  {opt.label}
                </Text>
                <Text style={st.optionDesc}>{opt.desc}</Text>
              </View>
              {settings.profile_visibility === opt.value && (
                <Ionicons name="checkmark-circle" size={22} color="#818cf8" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Activity & Privacy Toggles ── */}
        <Text style={st.sectionLabel}>ACTIVITY & PRIVACY</Text>
        <View style={st.card}>
          <View style={st.toggleRow}>
            <View style={st.toggleIcon}>
              <Ionicons name="ellipse" size={16} color="#22c55e" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={st.toggleLabel}>Show Online Status</Text>
              <Text style={st.toggleDesc}>Let others see when you're online</Text>
            </View>
            <Switch
              value={settings.show_online_status}
              onValueChange={(v) => update('show_online_status', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(129,140,248,0.4)' }}
              thumbColor={settings.show_online_status ? '#818cf8' : 'rgba(255,255,255,0.3)'}
            />
          </View>

          <View style={[st.toggleRow, st.toggleBorder]}>
            <View style={st.toggleIcon}>
              <Ionicons name="pulse-outline" size={18} color="#f472b6" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={st.toggleLabel}>Show Activity Status</Text>
              <Text style={st.toggleDesc}>Display your recent activity publicly</Text>
            </View>
            <Switch
              value={settings.show_activity_status}
              onValueChange={(v) => update('show_activity_status', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(244,114,182,0.4)' }}
              thumbColor={settings.show_activity_status ? '#f472b6' : 'rgba(255,255,255,0.3)'}
            />
          </View>

          <View style={[st.toggleRow, st.toggleBorder]}>
            <View style={st.toggleIcon}>
              <Ionicons name="person-add-outline" size={18} color="#fbbf24" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={st.toggleLabel}>Allow Friend Requests</Text>
              <Text style={st.toggleDesc}>Let others send you friend requests</Text>
            </View>
            <Switch
              value={settings.allow_friend_requests}
              onValueChange={(v) => update('allow_friend_requests', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(251,191,36,0.4)' }}
              thumbColor={settings.allow_friend_requests ? '#fbbf24' : 'rgba(255,255,255,0.3)'}
            />
          </View>
        </View>

        {/* ── DM Permissions ── */}
        <Text style={st.sectionLabel}>DIRECT MESSAGES</Text>
        <Text style={st.sectionHint}>Choose who can send you direct messages</Text>
        <View style={st.card}>
          {dmOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[st.optionRow, settings.allow_dm_from === opt.value && st.optionRowActive]}
              onPress={() => update('allow_dm_from', opt.value)}
              activeOpacity={0.7}
            >
              <View style={[st.optionIcon, settings.allow_dm_from === opt.value && st.optionIconActive]}>
                <Ionicons
                  name={opt.icon as any}
                  size={20}
                  color={settings.allow_dm_from === opt.value ? '#818cf8' : 'rgba(255,255,255,0.4)'}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[st.optionLabel, settings.allow_dm_from === opt.value && { color: '#fff' }]}>
                  {opt.label}
                </Text>
                <Text style={st.optionDesc}>{opt.desc}</Text>
              </View>
              {settings.allow_dm_from === opt.value && (
                <Ionicons name="checkmark-circle" size={22} color="#818cf8" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Account ── */}
        <Text style={st.sectionLabel}>ACCOUNT</Text>
        <View style={st.card}>
          <TouchableOpacity
            style={st.actionRow}
            activeOpacity={0.7}
            onPress={() => router.push('/(modals)/edit-profile' as any)}
          >
            <Ionicons name="create-outline" size={20} color="rgba(255,255,255,0.6)" />
            <Text style={st.actionLabel}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.actionRow, st.toggleBorder]}
            activeOpacity={0.7}
            onPress={() => router.push('/(modals)/notifications' as any)}
          >
            <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.6)" />
            <Text style={st.actionLabel}>Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.actionRow, st.toggleBorder]}
            activeOpacity={0.7}
            onPress={() => router.push('/(modals)/blocked-users' as any)}
          >
            <Ionicons name="ban-outline" size={20} color="rgba(255,255,255,0.6)" />
            <Text style={st.actionLabel}>Blocked Users</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
          </TouchableOpacity>
        </View>

        {/* Info footer */}
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>AnimeX v1.0</Text>
          <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, marginTop: 4 }}>
            Your weeb community 🎌
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  saveBtn: {
    backgroundColor: '#818cf8',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 6,
    paddingLeft: 4,
  },
  sectionHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginBottom: 10,
    paddingLeft: 4,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  optionRowActive: {
    backgroundColor: 'rgba(129,140,248,0.06)',
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: {
    backgroundColor: 'rgba(129,140,248,0.15)',
  },
  optionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  optionDesc: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginTop: 2,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  toggleBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDesc: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginTop: 2,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  actionLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
