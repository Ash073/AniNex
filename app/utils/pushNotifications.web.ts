export function markNotificationHandled(id: string): void {}
export function wasAlreadyHandled(id: string): boolean {
  return false;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications natively unsupported on Web via @react-native-firebase
  return null;
}

export function clearCachedToken(): void {}

export function onForegroundMessage(listener: any): () => void {
  return () => {};
}

export function onNotificationOpenedApp(listener: any): () => void {
  return () => {};
}

export async function getInitialNotification(): Promise<any | null> {
  return null;
}

export function onTokenRefresh(listener: any): () => void {
  return () => {};
}
