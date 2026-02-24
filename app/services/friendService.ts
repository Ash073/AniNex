import api from './api';

export const friendService = {
  /** Get the current user's accepted friends with profile details */
  async getFriends() {
    const res = await api.get('/friends/list');
    return res.data?.data?.friends || [];
  },

  /** Send a friend request to a user */
  async sendRequest(userId: string) {
    const res = await api.post(`/friends/request/${userId}`);
    return res.data;
  },

  /** Accept a pending friend request */
  async acceptRequest(requestId: string) {
    const res = await api.put(`/friends/accept/${requestId}`);
    return res.data;
  },

  /** Reject a pending friend request */
  async rejectRequest(requestId: string) {
    const res = await api.put(`/friends/reject/${requestId}`);
    return res.data;
  },

  /** Cancel a request I sent */
  async cancelRequest(userId: string) {
    const res = await api.delete(`/friends/cancel/${userId}`);
    return res.data;
  },

  /** Get pending requests I received */
  async getPending() {
    const res = await api.get('/friends/pending');
    return res.data?.data?.requests || [];
  },

  /** Get requests I sent that are still pending */
  async getSent() {
    const res = await api.get('/friends/sent');
    return res.data?.data?.requests || [];
  },
};
