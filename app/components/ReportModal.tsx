import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportService } from '../services/reportService';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: 'user' | 'post';
  targetId: string;
  targetName?: string;
}

const reportTypes = [
  { 
    id: 'spam', 
    title: 'Spam', 
    description: 'Unwanted or repetitive content',
    icon: 'mail-unread-outline'
  },
  { 
    id: 'harassment', 
    title: 'Harassment', 
    description: 'Bullying or unwanted aggressive behavior',
    icon: 'alert-circle-outline'
  },
  { 
    id: 'inappropriate_content', 
    title: 'Inappropriate Content', 
    description: 'Offensive or explicit material',
    icon: 'eye-off-outline'
  },
  { 
    id: 'impersonation', 
    title: 'Impersonation', 
    description: 'Someone pretending to be someone else',
    icon: 'person-circle-outline'
  },
  { 
    id: 'violence', 
    title: 'Violence', 
    description: 'Threats of harm or violent content',
    icon: 'shield-outline'
  },
  { 
    id: 'hate_speech', 
    title: 'Hate Speech', 
    description: 'Discriminatory or hateful content',
    icon: 'ban-outline'
  },
  { 
    id: 'other', 
    title: 'Other', 
    description: 'Something else that violates community guidelines',
    icon: 'ellipsis-horizontal-outline'
  }
];

export default function ReportModal({ visible, onClose, targetType, targetId, targetName }: ReportModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType || !reason.trim()) {
      Alert.alert('Error', 'Please select a report type and provide a reason');
      return;
    }

    setLoading(true);
    try {
      await reportService.createReport({
        reportType: selectedType as any,
        reason: reason.trim(),
        targetType,
        targetId,
        description: description.trim() || undefined
      });

      Alert.alert('Success', 'Report submitted successfully. Our team will review it shortly.');
      resetForm();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedType(null);
    setReason('');
    setDescription('');
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-gray-900 rounded-t-3xl p-6 max-h-[80%]">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-bold">
              Report {targetType === 'user' ? 'User' : 'Post'}
            </Text>
            <TouchableOpacity onPress={handleClose} disabled={loading}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {targetName && (
            <View className="bg-gray-800 rounded-xl p-4 mb-6">
              <Text className="text-gray-300 text-sm">Reporting:</Text>
              <Text className="text-white font-semibold mt-1">{targetName}</Text>
            </View>
          )}

          {/* Report Type Selection */}
          <Text className="text-white font-semibold mb-3">Select Report Type</Text>
          <View className="mb-6">
            {reportTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                className={`flex-row items-center p-4 rounded-xl mb-2 border ${
                  selectedType === type.id
                    ? 'bg-indigo-500/20 border-indigo-500'
                    : 'bg-gray-800 border-gray-700'
                }`}
                onPress={() => setSelectedType(type.id)}
                disabled={loading}
              >
                <Ionicons 
                  name={type.icon as any} 
                  size={20} 
                  color={selectedType === type.id ? '#818cf8' : '#9ca3af'} 
                />
                <View className="ml-3 flex-1">
                  <Text className={`font-semibold ${selectedType === type.id ? 'text-indigo-400' : 'text-white'}`}>
                    {type.title}
                  </Text>
                  <Text className="text-gray-400 text-sm mt-1">
                    {type.description}
                  </Text>
                </View>
                {selectedType === type.id && (
                  <Ionicons name="checkmark" size={20} color="#818cf8" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Reason Input */}
          <Text className="text-white font-semibold mb-3">Reason *</Text>
          <View className="bg-gray-800 rounded-xl p-4 mb-4">
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Briefly explain why you're reporting this..."
              placeholderTextColor="#9ca3af"
              className="text-white"
              multiline
              numberOfLines={3}
              maxLength={200}
              editable={!loading}
            />
            <Text className="text-gray-500 text-xs mt-2 text-right">
              {reason.length}/200
            </Text>
          </View>

          {/* Additional Description */}
          <Text className="text-white font-semibold mb-3">Additional Details (Optional)</Text>
          <View className="bg-gray-800 rounded-xl p-4 mb-6">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Provide any additional context..."
              placeholderTextColor="#9ca3af"
              className="text-white"
              multiline
              numberOfLines={4}
              maxLength={500}
              editable={!loading}
            />
            <Text className="text-gray-500 text-xs mt-2 text-right">
              {description.length}/500
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            className={`py-4 rounded-xl items-center ${
              loading || !selectedType || !reason.trim()
                ? 'bg-gray-700'
                : 'bg-indigo-600'
            }`}
            onPress={handleSubmit}
            disabled={loading || !selectedType || !reason.trim()}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold">
                Submit Report
              </Text>
            )}
          </TouchableOpacity>

          <Text className="text-gray-500 text-xs text-center mt-4">
            Reports are reviewed by our moderation team. False reports may result in account restrictions.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Add missing imports
import { TextInput, ActivityIndicator } from 'react-native';