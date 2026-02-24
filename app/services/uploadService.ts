import { Platform } from 'react-native';
import { API_URL } from '@/constants/api';
import * as SecureStore from 'expo-secure-store';

/** Get the auth token for the upload request */
async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem('token');
  }
  return await SecureStore.getItemAsync('token');
}

/**
 * Upload an image via XMLHttpRequest.
 * This is the most reliable way on React Native — it uses the native networking
 * layer directly and correctly handles file:// URIs in FormData, unlike
 * Axios (Network Error) or the whatwg-fetch polyfill (Network request failed).
 */
function xhrUpload(url: string, formData: FormData, token: string | null): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // Do NOT set Content-Type — XHR sets the correct multipart boundary automatically

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        console.error('[Upload] Server error:', xhr.status, xhr.responseText);
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      console.error('[Upload] XHR error');
      reject(new Error('Network request failed'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out'));
    };

    xhr.timeout = 60000; // 60s for large images
    xhr.send(formData);
  });
}

/**
 * Upload an image to the backend and get a public URL back.
 * Accepts a local file URI (from ImagePicker).
 */
export async function uploadImage(uri: string): Promise<string> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append('image', blob, `image-${Date.now()}.jpg`);
  } else {
    // On Android, expo-image-picker with allowsEditing can return cache URIs
    // without a file extension. Ensure we always have a valid filename and type.
    let filename = uri.split('/').pop() || `image-${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    let type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

    // If no extension, default to .jpg
    if (!match) {
      filename = `${filename}.jpg`;
      type = 'image/jpeg';
    }

    // Normalize common extension mismatches
    if (type === 'image/jpg') type = 'image/jpeg';

    formData.append('image', {
      uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: filename,
      type,
    } as any);
  }

  try {
    const token = await getToken();
    const uploadUrl = `${API_URL}/upload`;
    console.log('[Upload] Sending to', uploadUrl, 'file URI:', uri.substring(0, 80));

    let data: any;
    if (Platform.OS === 'web') {
      // Web: use fetch
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error('[Upload] Server error:', response.status, errText);
        throw new Error(`Upload failed: ${response.status}`);
      }
      data = await response.json();
    } else {
      // Native: use XMLHttpRequest for reliable file URI uploads
      data = await xhrUpload(uploadUrl, formData, token);
    }

    if (!data?.data?.url) {
      console.error('[Upload] No URL in response:', JSON.stringify(data));
      throw new Error('Upload succeeded but no URL was returned');
    }

    console.log('[Upload] Success:', data.data.url);
    return data.data.url;
  } catch (error: any) {
    console.error('[Upload] Failed for', uri.substring(0, 60), ':', error?.message || error);
    throw error;
  }
}
