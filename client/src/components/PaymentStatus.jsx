import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

const PaymentStatus = ({ status, transactionId, onRetry, onCancel }) => {
  const [countdown, setCountdown] = useState(300); // 5 minutes timeout

  useEffect(() => {
    if (status === 'processing') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusDisplay = () => {
    switch (status) {
      case 'idle':
        return {
          icon: <Clock className="h-8 w-8 text-gray-400" />,
          title: 'Payment Pending',
          message: 'Waiting to initiate payment...',
          color: 'text-gray-600'
        };
      case 'processing':
        return {
          icon: <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />,
          title: 'Processing Payment',
          message: `Please complete the M-Pesa payment. Time remaining: ${formatTime(countdown)}`,
          color: 'text-blue-600'
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-8 w-8 text-green-500" />,
          title: 'Payment Successful',
          message: `Transaction ID: ${transactionId}`,
          color: 'text-green-600'
        };
      case 'failed':
        return {
          icon: <XCircle className="h-8 w-8 text-red-500" />,
          title: 'Payment Failed',
          message: 'Payment could not be completed. Please try again.',
          color: 'text-red-600'
        };
      case 'timeout':
        return {
          icon: <Clock className="h-8 w-8 text-orange-500" />,
          title: 'Payment Timeout',
          message: 'Payment timed out. Please try again.',
          color: 'text-orange-600'
        };
      default:
        return {
          icon: <Clock className="h-8 w-8 text-gray-400" />,
          title: 'Unknown Status',
          message: 'Payment status unknown.',
          color: 'text-gray-600'
        };
    }
  };

  const { icon, title, message, color } = getStatusDisplay();

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md">
      <div className="mb-4">
        {icon}
      </div>
      <h3 className={`text-lg font-semibold mb-2 ${color}`}>
        {title}
      </h3>
      <p className="text-gray-600 text-center mb-4 max-w-md">
        {message}
      </p>

      {status === 'processing' && (
        <div className="text-sm text-gray-500 mb-4">
          <p>Check your phone for the M-Pesa payment prompt.</p>
          <p>Enter your M-Pesa PIN to complete the payment.</p>
        </div>
      )}

      {(status === 'failed' || status === 'timeout') && onRetry && (
        <button
          onClick={onRetry}
          className="btn-primary mr-2"
        >
          Try Again
        </button>
      )}

      {status === 'processing' && onCancel && (
        <button
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default PaymentStatus;