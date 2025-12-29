import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CreditCard, TrendingUp, CheckCircle, LogOut, User, MessageSquare, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLoan } from '../context/LoanContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { loans, loading, fetchLoanHistory } = useLoan();
  const [stats, setStats] = useState({
    creditScore: 0,
    loanLimit: 0,
    loansApplied: 0,
    loansApproved: 0,
  });
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  useEffect(() => {
    fetchLoanHistory();
    fetchMessages();
  }, []); // Remove fetchLoanHistory from dependency to prevent infinite re-renders

  const fetchMessages = async () => {
    try {
      const response = await api.get('/user/messages?limit=5');
      setMessages(response.data.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const markMessageAsRead = async (messageId) => {
    try {
      await api.patch(`/user/messages/${messageId}/read`);
      setMessages(prev =>
        prev.map(msg =>
          msg._id === messageId ? { ...msg, isRead: true } : msg
        )
      );
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  useEffect(() => {
    if (user) {
      setStats({
        creditScore: user.creditScore,
        loanLimit: user.loanLimit,
        loansApplied: user.totalLoansApplied,
        loansApproved: user.totalLoansApproved,
      });
    }
  }, [user]);

  // Prepare chart data
  const chartData = loans
    .filter(loan => loan.status === 'approved' || loan.status === 'paid')
    .map(loan => ({
      date: new Date(loan.createdAt).toLocaleDateString(),
      amount: loan.amount,
    }))
    .reverse();

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
      paid: 'status-paid',
      defaulted: 'status-defaulted',
    };

    return (
      <span className={`status-badge ${statusClasses[status] || 'status-pending'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">JAMII LOAN Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-700">{user?.fullName}</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <CreditCard className="h-8 w-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Credit Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.creditScore}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-secondary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Loan Limit</p>
                <p className="text-2xl font-bold text-gray-900">KSh {stats.loanLimit.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <Plus className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Loans Applied</p>
                <p className="text-2xl font-bold text-gray-900">{stats.loansApplied}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Loans Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.loansApproved}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Section */}
        <div className="mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                Admin Messages
              </h3>
              <Link
                to="/notifications"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View All
              </Link>
            </div>
            {messagesLoading ? (
              <div className="flex justify-center py-4">
                <div className="spinner"></div>
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-3">
                {messages.slice(0, 3).map((message) => (
                  <div
                    key={message._id}
                    className={`border rounded-lg p-3 ${
                      !message.isRead ? 'border-l-4 border-l-blue-500 bg-blue-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{message.title}</h4>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-2">{message.content}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(message.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {!message.isRead && (
                        <button
                          onClick={() => markMessageAsRead(message._id)}
                          className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No messages from admin</p>
              </div>
            )}
          </div>
        </div>

        {/* Apply for Loan Button */}
        <div className="mb-8">
          <Link
            to="/apply-loan"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Apply for a Loan
          </Link>
        </div>

        {/* Charts and Loan History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Loan Amount Chart */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Loan History Chart</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`KSh ${value.toLocaleString()}`, 'Amount']} />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No approved loans to display
              </div>
            )}
          </div>

          {/* Loan History Table */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Loans</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="spinner"></div>
              </div>
            ) : loans.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loans.slice(0, 5).map((loan) => (
                      <tr key={loan._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          KSh {loan.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          KSh {loan.feeAmount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(loan.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(loan.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No loans found. Apply for your first loan!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
