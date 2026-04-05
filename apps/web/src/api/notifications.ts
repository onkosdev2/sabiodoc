import client from './client'

export interface NotificationItem {
  id: number
  type: string
  title: string
  body: string
  action_url: string | null
  action_label: string | null
  status: 'unread' | 'read'
  created_at: string
  read_at: string | null
  metadata: Record<string, unknown> | null
}

export interface NotificationListResponse {
  notifications: NotificationItem[]
  total: number
  unread: number
}

export const getMyNotifications = async (): Promise<NotificationListResponse> => {
  const response = await client.get<NotificationListResponse>('/notifications/my')
  return response.data
}

export const markNotificationAsRead = async (notificationId: number): Promise<NotificationItem> => {
  const response = await client.post<NotificationItem>(`/notifications/${notificationId}/read`)
  return response.data
}

export const markAllNotificationsAsRead = async (): Promise<NotificationListResponse> => {
  const response = await client.post<NotificationListResponse>('/notifications/read-all')
  return response.data
}
