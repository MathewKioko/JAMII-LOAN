import { useState } from 'react';
import { CheckCircle, X, FileText, CreditCard, Phone } from 'lucide-react';

const LoanReconfirmation = ({ applicationData, onConfirm, onCancel }) => {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState({});

  const { amount, phoneNumber, description, feeAmount } = applicationData;
  const totalAmount = amount + feeAmount;

  const handleConfirm = () => {
    const newErrors = {};

    if (!acceptedTerms) {
      newErrors.terms = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Confirm Loan Application</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Application Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Application Summary</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Loan Amount:</span>
                <span className="font-semibold">KSh {amount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Processing Fee:</span>
                <span className="font-semibold">KSh {feeAmount.toLocaleString()}</span>
              </div>

              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-medium text-gray-900">Total Payment:</span>
                <span className="font-bold text-lg text-primary-600">KSh {totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Phone Number */}
          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
            <Phone className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">M-Pesa Phone Number</p>
              <p className="text-sm text-blue-700">{phoneNumber}</p>
            </div>
          </div>

          {/* Description */}
          {description && (
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Purpose of Loan</p>
                <p className="text-sm text-gray-700">{description}</p>
              </div>
            </div>
          )}

          {/* Terms and Conditions */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Terms and Conditions</h4>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• I agree to pay the processing fee of KSh 50 via M-Pesa.</p>
              <p>• My application will be reviewed by the admin team within 24-48 hours.</p>
              <p>• I understand that loan approval is subject to eligibility criteria.</p>
              <p>• I authorize JAMII LOAN to process my loan application.</p>
            </div>

            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-900">
                  I accept the terms and conditions
                </span>
              </label>
              {errors.terms && (
                <p className="mt-1 text-sm text-red-600">{errors.terms}</p>
              )}
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <CreditCard className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-900">Payment Required</p>
                <p className="text-sm text-yellow-800">
                  You will receive an M-Pesa payment prompt after confirmation. Complete the payment to submit your application.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onCancel}
            className="flex-1 btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!acceptedTerms}
            className="flex-1 btn-primary flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Confirm & Pay
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoanReconfirmation;