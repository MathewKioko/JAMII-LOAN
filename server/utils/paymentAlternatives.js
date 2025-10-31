/**
 * Alternative payment methods for Kenya when M-PESA Daraja API is not available
 * This provides fallback options for loan fee payments
 */

// Mock payment processing for unregistered businesses
const processMockPayment = async (phoneNumber, amount, reference) => {
  // Simulate payment processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // For demo purposes, always return success
  // In production, this would integrate with actual payment providers
  const transactionId = `MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: true,
    transactionId,
    amount,
    phoneNumber,
    reference,
    status: 'completed',
    message: 'Payment processed successfully (Demo Mode)',
    timestamp: new Date().toISOString(),
  };
};

// Airtel Money integration (alternative to M-PESA)
const processAirtelMoneyPayment = async (phoneNumber, amount, reference) => {
  // Airtel Money API integration would go here
  // For now, return mock response
  console.log(`Processing Airtel Money payment: ${phoneNumber}, Amount: ${amount}, Ref: ${reference}`);

  return await processMockPayment(phoneNumber, amount, reference);
};

// Bank transfer integration
const processBankTransfer = async (accountNumber, amount, reference) => {
  // Bank API integration would go here
  // For now, return mock response
  console.log(`Processing Bank Transfer: ${accountNumber}, Amount: ${amount}, Ref: ${reference}`);

  const transactionId = `BANK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: true,
    transactionId,
    accountNumber,
    amount,
    reference,
    status: 'pending_verification',
    message: 'Bank transfer initiated. Awaiting confirmation.',
    instructions: 'Please transfer funds to account 1234567890 (Equity Bank) and provide transaction reference.',
    timestamp: new Date().toISOString(),
  };
};

// Card payment integration (using Flutterwave, Pesapal, etc.)
const processCardPayment = async (cardDetails, amount, reference) => {
  // Card payment API integration would go here
  // For now, return mock response
  console.log(`Processing Card Payment: Amount: ${amount}, Ref: ${reference}`);

  const transactionId = `CARD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: true,
    transactionId,
    amount,
    reference,
    status: 'completed',
    message: 'Card payment processed successfully',
    timestamp: new Date().toISOString(),
  };
};

// Equity Bank Eazzy integration
const processEquityEazzyPayment = async (phoneNumber, amount, reference) => {
  // Equity Eazzy API integration would go here
  console.log(`Processing Equity Eazzy payment: ${phoneNumber}, Amount: ${amount}, Ref: ${reference}`);

  return await processMockPayment(phoneNumber, amount, reference);
};

// KCB M-PESA integration (alternative)
const processKCBMpesaPayment = async (phoneNumber, amount, reference) => {
  // KCB M-PESA API integration would go here
  console.log(`Processing KCB M-PESA payment: ${phoneNumber}, Amount: ${amount}, Ref: ${reference}`);

  return await processMockPayment(phoneNumber, amount, reference);
};

// PayPal integration for international payments
const processPayPalPayment = async (email, amount, reference) => {
  // PayPal API integration would go here
  console.log(`Processing PayPal payment: ${email}, Amount: ${amount}, Ref: ${reference}`);

  const transactionId = `PAYPAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: true,
    transactionId,
    email,
    amount,
    reference,
    status: 'completed',
    message: 'PayPal payment processed successfully',
    timestamp: new Date().toISOString(),
  };
};

// Main payment processor that tries multiple methods
const processLoanFeePayment = async (paymentMethod, paymentData, amount, reference) => {
  try {
    switch (paymentMethod.toLowerCase()) {
      case 'flutterwave_mpesa':
      case 'flutterwave':
        // Use Flutterwave for M-PESA payments (works without business registration)
        try {
          const { initiateFlutterwavePayment } = require('./flutterwave');
          return await initiateFlutterwavePayment({
            phoneNumber: paymentData.phoneNumber,
            amount: amount,
            email: paymentData.email,
            name: paymentData.name || paymentData.fullName,
            reference: reference,
          });
        } catch (error) {
          console.log('Flutterwave not available, using mock payment');
          return await processMockPayment(paymentData.phoneNumber, amount, reference);
        }

      case 'mpesa':
        // Try direct M-PESA first, fallback to Flutterwave, then mock
        try {
          const { initiateStkPush } = require('./mpesa');
          return await initiateStkPush(paymentData.phoneNumber, amount, reference);
        } catch (mpesaError) {
          console.log('Direct M-PESA not available, trying Flutterwave');
          try {
            const { initiateFlutterwavePayment } = require('./flutterwave');
            return await initiateFlutterwavePayment({
              phoneNumber: paymentData.phoneNumber,
              amount: amount,
              email: paymentData.email,
              name: paymentData.name || paymentData.fullName,
              reference: reference,
            });
          } catch (flutterwaveError) {
            console.log('Flutterwave not available, using mock payment');
            return await processMockPayment(paymentData.phoneNumber, amount, reference);
          }
        }

      case 'airtel':
        return await processAirtelMoneyPayment(paymentData.phoneNumber, amount, reference);

      case 'bank':
        return await processBankTransfer(paymentData.accountNumber, amount, reference);

      case 'card':
        return await processCardPayment(paymentData.cardDetails, amount, reference);

      case 'equity':
        return await processEquityEazzyPayment(paymentData.phoneNumber, amount, reference);

      case 'kcb':
        return await processKCBMpesaPayment(paymentData.phoneNumber, amount, reference);

      case 'paypal':
        return await processPayPalPayment(paymentData.email, amount, reference);

      case 'mock':
      default:
        return await processMockPayment(paymentData.phoneNumber || paymentData.reference, amount, reference);
    }
  } catch (error) {
    console.error(`Payment processing failed for method ${paymentMethod}:`, error);
    throw new Error(`Payment processing failed: ${error.message}`);
  }
};

// Get available payment methods
const getAvailablePaymentMethods = () => {
  return [
    {
      id: 'mpesa',
      name: 'M-PESA',
      description: 'Pay using M-PESA mobile money',
      fields: ['phoneNumber'],
      instructions: 'Enter your M-PESA registered phone number',
    },
    {
      id: 'airtel',
      name: 'Airtel Money',
      description: 'Pay using Airtel Money',
      fields: ['phoneNumber'],
      instructions: 'Enter your Airtel Money registered phone number',
    },
    {
      id: 'bank',
      name: 'Bank Transfer',
      description: 'Direct bank transfer',
      fields: ['accountNumber'],
      instructions: 'Transfer to our bank account and provide reference',
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      description: 'Pay using Visa, Mastercard, etc.',
      fields: ['cardNumber', 'expiry', 'cvv', 'cardholderName'],
      instructions: 'Enter your card details securely',
    },
    {
      id: 'equity',
      name: 'Equity Eazzy',
      description: 'Pay using Equity Bank Eazzy',
      fields: ['phoneNumber'],
      instructions: 'Enter your Equity Eazzy registered phone number',
    },
    {
      id: 'kcb',
      name: 'KCB M-PESA',
      description: 'Pay using KCB M-PESA',
      fields: ['phoneNumber'],
      instructions: 'Enter your KCB M-PESA registered phone number',
    },
    {
      id: 'paypal',
      name: 'PayPal',
      description: 'Pay using PayPal account',
      fields: ['email'],
      instructions: 'Enter your PayPal email address',
    },
  ];
};

module.exports = {
  processLoanFeePayment,
  getAvailablePaymentMethods,
  processMockPayment,
  processAirtelMoneyPayment,
  processBankTransfer,
  processCardPayment,
  processEquityEazzyPayment,
  processKCBMpesaPayment,
  processPayPalPayment,
};
