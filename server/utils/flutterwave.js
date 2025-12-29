const Flutterwave = require('flutterwave-node-v3');
const Transaction = require('../models/Transaction');

// Initialize Flutterwave with environment variables (only if keys are available)
let flw = null;
if (process.env.FLUTTERWAVE_PUBLIC_KEY && process.env.FLUTTERWAVE_SECRET_KEY) {
  flw = new Flutterwave(
    process.env.FLUTTERWAVE_PUBLIC_KEY,
    process.env.FLUTTERWAVE_SECRET_KEY
  );
}

/**
 * Initialize a payment with Flutterwave
 * @param {Object} paymentData - Payment details
 * @param {string} paymentData.phoneNumber - Customer's phone number
 * @param {number} paymentData.amount - Amount to charge
 * @param {string} paymentData.email - Customer's email
 * @param {string} paymentData.name - Customer's name
 * @param {string} paymentData.reference - Unique transaction reference
 * @returns {Object} Payment initialization response
 */
const initiateFlutterwavePayment = async (paymentData) => {
  try {
    const { phoneNumber, amount, email, name, reference } = paymentData;

    // Validate required fields
    if (!phoneNumber || !amount || !email || !name || !reference) {
      throw new Error('Missing required payment data');
    }

    // Prepare payment payload for M-PESA
    const payload = {
      tx_ref: reference,
      amount: amount,
      currency: 'KES',
      redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
      payment_options: 'mobilemoney',
      customer: {
        email: email,
        phone_number: phoneNumber,
        name: name,
      },
      customizations: {
        title: 'JAMII LOAN - Processing Fee Payment',
        description: `Processing fee payment of KSh ${amount.toLocaleString()}`,
        logo: 'https://your-logo-url.com/logo.png', // Replace with your logo URL
      },
      meta: {
        consumer_id: reference,
        consumer_mac: '92a3-912ba-1192a',
      },
    };

    console.log('Initiating Flutterwave payment:', payload);

    // Initialize payment
    const response = await flw.Charge.mobile_money(payload);

    console.log('Flutterwave response:', response);

    if (response.status === 'success') {
      return {
        success: true,
        transactionId: response.data.id,
        checkoutRequestID: response.data.tx_ref,
        responseCode: response.data.flw_ref,
        responseDescription: response.message,
        customerMessage: response.data.processor_response || 'Payment initiated successfully',
        merchantRequestId: response.data.tx_ref,
        ...response.data,
      };
    } else {
      throw new Error(response.message || 'Payment initialization failed');
    }
  } catch (error) {
    console.error('Flutterwave payment initiation error:', error);
    throw new Error(`Payment initiation failed: ${error.message}`);
  }
};

/**
 * Verify payment status with Flutterwave
 * @param {string} transactionId - Flutterwave transaction ID
 * @returns {Object} Verification response
 */
const verifyFlutterwavePayment = async (transactionId) => {
  try {
    console.log('Verifying Flutterwave payment:', transactionId);

    const response = await flw.Transaction.verify({ id: transactionId });

    console.log('Flutterwave verification response:', response);

    if (response.status === 'success') {
      const { data } = response;

      return {
        success: true,
        transactionId: data.id,
        tx_ref: data.tx_ref,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        payment_type: data.payment_type,
        customer: data.customer,
        verified: data.status === 'successful',
        message: data.status === 'successful' ? 'Payment verified successfully' : 'Payment not completed',
      };
    } else {
      return {
        success: false,
        message: response.message || 'Payment verification failed',
      };
    }
  } catch (error) {
    console.error('Flutterwave verification error:', error);
    return {
      success: false,
      message: `Verification failed: ${error.message}`,
    };
  }
};

/**
 * Handle Flutterwave webhook
 * @param {Object} webhookData - Webhook payload from Flutterwave
 * @returns {Object} Webhook processing response
 */
const handleFlutterwaveWebhook = async (webhookData) => {
  try {
    console.log('Processing Flutterwave webhook:', webhookData);

    // Verify webhook signature (recommended for production)
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
    if (secretHash) {
      const signature = webhookData['verif-hash'];
      if (!signature || signature !== secretHash) {
        throw new Error('Invalid webhook signature');
      }
    }

    const { id, tx_ref, status, amount, currency } = webhookData;

    // Find transaction in database
    const transaction = await Transaction.findOne({ 'mpesaResponse.checkoutRequestID': tx_ref });

    if (!transaction) {
      console.log('Transaction not found for reference:', tx_ref);
      return { success: false, message: 'Transaction not found' };
    }

    // Update transaction status
    if (status === 'successful') {
      transaction.mpesaResponse.status = 'completed';
      transaction.mpesaResponse.completedAt = new Date();
      transaction.mpesaResponse.flutterwaveData = webhookData;

      // Update loan fee status if this was a fee payment
      if (transaction.loanId) {
        const Loan = require('../models/Loan');
        const loan = await Loan.findById(transaction.loanId);
        if (loan && !loan.feePaid) {
          loan.feePaid = true;
          await loan.save();
          console.log('Loan fee marked as paid:', loan._id);
        }
      }

      await transaction.save();

      console.log('Payment completed successfully:', tx_ref);
      return { success: true, message: 'Payment completed successfully' };
    } else if (status === 'failed') {
      transaction.mpesaResponse.status = 'failed';
      transaction.mpesaResponse.failedAt = new Date();
      transaction.mpesaResponse.flutterwaveData = webhookData;
      await transaction.save();

      console.log('Payment failed:', tx_ref);
      return { success: false, message: 'Payment failed' };
    }

    return { success: true, message: 'Webhook processed' };
  } catch (error) {
    console.error('Flutterwave webhook processing error:', error);
    return { success: false, message: `Webhook processing failed: ${error.message}` };
  }
};

/**
 * Get payment methods available through Flutterwave
 * @returns {Array} List of available payment methods
 */
const getFlutterwavePaymentMethods = () => {
  return [
    {
      id: 'flutterwave_mpesa',
      name: 'M-PESA via Flutterwave',
      description: 'Pay using M-PESA (works without business registration)',
      provider: 'flutterwave',
      fields: ['phoneNumber', 'email', 'name'],
      instructions: 'Enter your M-PESA phone number, email, and full name',
      currency: 'KES',
      minAmount: 1,
      maxAmount: 150000, // Flutterwave limits
    },
    {
      id: 'flutterwave_card',
      name: 'Card Payment via Flutterwave',
      description: 'Pay using Visa, Mastercard, or other cards',
      provider: 'flutterwave',
      fields: ['cardNumber', 'expiryMonth', 'expiryYear', 'cvv', 'email', 'name'],
      instructions: 'Enter your card details and billing information',
      currency: 'KES',
      minAmount: 1,
      maxAmount: 1000000,
    },
    {
      id: 'flutterwave_bank',
      name: 'Bank Transfer via Flutterwave',
      description: 'Pay via direct bank transfer',
      provider: 'flutterwave',
      fields: ['accountNumber', 'bankCode', 'email', 'name'],
      instructions: 'Enter your bank account details',
      currency: 'KES',
      minAmount: 1,
      maxAmount: 1000000,
    },
  ];
};

module.exports = {
  initiateFlutterwavePayment,
  verifyFlutterwavePayment,
  handleFlutterwaveWebhook,
  getFlutterwavePaymentMethods,
  flw, // Export the Flutterwave instance for advanced usage
};
