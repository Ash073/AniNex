import api from './api';

export interface Report {
  id: string;
  report_type: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
  reporter?: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
  };
  reported_user?: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
  };
  reported_post?: {
    id: string;
    content: string;
    title?: string;
    author_id: string;
  };
}

export interface CreateReportData {
  reportType: 'spam' | 'harassment' | 'inappropriate_content' | 'impersonation' | 'violence' | 'hate_speech' | 'other';
  reason: string;
  targetType: 'user' | 'post';
  targetId: string;
  description?: string;
}

export const reportService = {
  // Create a new report
  createReport: async (reportData: CreateReportData) => {
    const { data } = await api.post<{ success: boolean; message: string; data: { reportId: string } }>('/reports', reportData);
    return data;
  },

  // Get reports (admin only)
  getReports: async (params?: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const { data } = await api.get<{ 
      success: boolean; 
      data: { 
        reports: Report[]; 
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        }
      } 
    }>(`/reports?${queryParams}`);
    return data.data;
  },

  // Get my reports
  getMyReports: async (params?: {
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const { data } = await api.get<{ 
      success: boolean; 
      data: { 
        reports: Report[]; 
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        }
      } 
    }>(`/reports/my-reports?${queryParams}`);
    return data.data;
  },

  // Update report status (admin only)
  updateReportStatus: async (reportId: string, status: 'pending' | 'reviewed' | 'resolved' | 'dismissed', notes?: string) => {
    const { data } = await api.put(`/reports/${reportId}/status`, { status, notes });
    return data;
  }
};