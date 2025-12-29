import { CheckCircle, XCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react';

const RefundStatus = ({ loanId, refundStatus, transactionId }) => {
  const getStatusDisplay = () => {
    switch (refundStatus) {
      case 'pending':
        return {
          icon: <Clock className="h-6 w-6 text-yellow-500" />,
          title: 'Refund Pending',
          message: 'Your refund is being processed. This may take a few minutes.',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'processing':
        return {
          icon: <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />,
          title: 'Processing Refund',
          message: 'Refund is currently being processed by M-Pesa.',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 'processed':
        return {
          icon: <CheckCircle className="h-6 w-6 text-green-500" />,
          title: 'Refund Completed',
          message: `Refund has been successfully processed. Transaction ID: ${transactionId}`,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'failed':
        return {
          icon: <XCircle className="h-6 w-6 text-red-500" />,
          title: 'Refund Failed',
          message: 'Refund could not be processed. Please contact support.',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: <AlertCircle className="h-6 w-6 text-gray-500" />,
          title: 'Refund Status Unknown',
          message: 'Unable to determine refund status. Please check back later.',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const { icon, title, message, color, bgColor, borderColor } = getStatusDisplay();

  return (
    <div className={`rounded-lg border p-4 ${bgColor} ${borderColor}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <h4 className={`text-sm font-medium ${color}`}>
            {title}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            {message}
          </p>
          {refundStatus === 'processed' && transactionId && (
            <p className="text-xs text-gray-500 mt-2">
              Reference: {transactionId}
            </p>
          )}
          {refundStatus === 'failed' && (
            <div className="mt-2">
              <button className="text-sm text-blue-600 hover:text-blue-800 underline">
                Contact Support
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefundStatus;