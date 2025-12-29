import { createContext, useContext, useState } from 'react';
import api from '../api/axios';

const LoanContext = createContext();

export const useLoan = () => {
  const context = useContext(LoanContext);
  if (!context) {
    throw new Error('useLoan must be used within a LoanProvider');
  }
  return context;
};

export const LoanProvider = ({ children }) => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [systemSettings, setSystemSettings] = useState(null);

  // Check loan eligibility
  const checkEligibility = async () => {
    try {
      console.log('Making eligibility API call...');
      setLoading(true);
      const response = await api.get('/user/eligibility');
      console.log('Eligibility API response:', response.data);
      setEligibility(response.data.data);
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('Eligibility API error:', error);
      const message = error.response?.data?.message || 'Failed to check eligibility';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Fetch system settings
  const fetchSystemSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/user/settings');
      setSystemSettings(response.data.data);
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('System settings API error:', error);
      const message = error.response?.data?.message || 'Failed to fetch system settings';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Apply for loan
  const applyLoan = async (loanData) => {
    try {
      setLoading(true);
      const response = await api.post('/loan/apply', loanData);
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to apply for loan';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Fetch loan history
  const fetchLoanHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/user/loans');
      setLoans(response.data.data);
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch loan history';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Get all loans (admin)
  const getAllLoans = async (params = {}) => {
    try {
      setLoading(true);
      const queryString = new URLSearchParams(params).toString();
      const url = `/admin/loans${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      return { success: true, data: response.data.data, pagination: response.data.pagination };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch loans';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Approve loan (admin)
  const approveLoanAdmin = async (loanId) => {
    try {
      setLoading(true);
      const response = await api.patch(`/admin/loan/${loanId}/approve`);
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to approve loan';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Reject loan (admin)
  const rejectLoanAdmin = async (loanId, rejectionReason) => {
    try {
      setLoading(true);
      const response = await api.patch(`/admin/loan/${loanId}/reject`, { rejectionReason });
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to reject loan';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Auto-approve loan (admin)
  const autoApproveLoanAdmin = async (loanId) => {
    try {
      setLoading(true);
      const response = await api.patch(`/admin/loan/${loanId}/auto-approve`);
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to auto-approve loan';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Special approve loan (admin)
  const specialApproveLoanAdmin = async (loanId) => {
    try {
      setLoading(true);
      const response = await api.patch(`/admin/loan/${loanId}/special-approve`);
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to special approve loan';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Get loan queue (admin)
  const getLoanQueue = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/loan-queue');
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch loan queue';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Initiate loan disbursement (admin)
  const initiateLoanDisbursement = async (loanId) => {
    try {
      setLoading(true);
      const response = await api.post(`/admin/loan/${loanId}/disbursement`);
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to initiate disbursement';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Get admin stats
  const getAdminStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/stats');
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch admin stats';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Send approval notification (admin)
  const sendApprovalNotification = async (loanId) => {
    try {
      setLoading(true);
      const response = await api.post(`/admin/loan/${loanId}/notify-approval`);
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to send notification';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Process refund (admin)
  const processRefund = async (loanId) => {
    try {
      setLoading(true);
      const response = await api.post(`/admin/loan/${loanId}/refund`);
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to process refund';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Get all users (admin)
  const getAllUsers = async (params = {}) => {
    try {
      setLoading(true);
      const queryString = new URLSearchParams(params).toString();
      const url = `/admin/users${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      return { success: true, data: response.data.data, pagination: response.data.pagination };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch users';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Update user (admin)
  const updateUserAdmin = async (userId, userData) => {
    try {
      setLoading(true);
      const response = await api.patch(`/admin/users/${userId}`, userData);
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update user';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Toggle user status (admin)
  const toggleUserStatus = async (userId, isActive) => {
    try {
      setLoading(true);
      const response = await api.patch(`/admin/users/${userId}/status`, { isActive });
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update user status';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Get system settings (admin)
  const getSystemSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/settings');
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch system settings';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Update system setting (admin)
  const updateSystemSetting = async (key, value) => {
    try {
      setLoading(true);
      const response = await api.patch(`/admin/settings/${key}`, { value });
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update system setting';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Get audit logs (admin)
  const getAuditLogs = async (params = {}) => {
    try {
      setLoading(true);
      const queryString = new URLSearchParams(params).toString();
      const url = `/admin/audit-logs${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      return { success: true, data: response.data.data, pagination: response.data.pagination };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch audit logs';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Get system status (admin)
  const getSystemStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/system-status');
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch system status';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    loans,
    loading,
    eligibility,
    systemSettings,
    checkEligibility,
    fetchSystemSettings,
    applyLoan,
    fetchLoanHistory,
    getAllLoans,
    approveLoanAdmin,
    rejectLoanAdmin,
    autoApproveLoanAdmin,
    specialApproveLoanAdmin,
    getLoanQueue,
    initiateLoanDisbursement,
    getAdminStats,
    sendApprovalNotification,
    processRefund,
    getAllUsers,
    updateUserAdmin,
    toggleUserStatus,
    getSystemSettings,
    updateSystemSetting,
    getAuditLogs,
    getSystemStatus,
  };

  return (
    <LoanContext.Provider value={value}>
      {children}
    </LoanContext.Provider>
  );
};
