const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const Transaction = require('../models/Transaction');

/**
 * Create a Stripe payment intent
 * @param {Object} paymentData - Payment details
 * @param {number} paymentData.amount - Amount to charge in cents
 * @param {string} paymentData.currency - Currency code (default: 'kes')
 * @param {string} paymentData.reference - Unique transaction reference
 * @param {Object} paymentData.metadata - Additional metadata
 * @returns {Object} Payment intent response
 */
const createPaymentIntent = async (paymentData) => {
  try {
    const { amount, currency = 'kes', reference, metadata = {} } = paymentData;

    // Validate required fields
    if (!amount || !reference) {
      throw new Error('Missing required payment data: amount and reference');
    }

    // Check if Stripe is configured
    if (!stripe) {
      throw new Error('Stripe not configured');
    }

    // Convert amount to cents for Stripe (KES is already in cents)
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      metadata: {
        reference,
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('Stripe payment intent created:', paymentIntent.id);

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      currency: currency,
      reference: reference,
      status: paymentIntent.status,
      message: 'Payment intent created successfully',
    };
  } catch (error) {
    console.error('Stripe payment intent creation error:', error);
    throw new Error(`Payment intent creation failed: ${error.message}`);
  }
};

/**
 * Confirm a Stripe payment intent
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @param {Object} paymentMethodData - Payment method data
 * @returns {Object} Confirmation response
 */
const confirmPaymentIntent = async (paymentIntentId, paymentMethodData) => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method_data: paymentMethodData,
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100, // Convert back from cents
      currency: paymentIntent.currency,
    };
  } catch (error) {
    console.error('Stripe payment intent confirmation error:', error);
    throw new Error(`Payment confirmation failed: ${error.message}`);
  }
};

/**
 * Retrieve a Stripe payment intent
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @returns {Object} Payment intent details
 */
const retrievePaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
      charges: paymentIntent.charges,
    };
  } catch (error) {
    console.error('Stripe payment intent retrieval error:', error);
    throw new Error(`Payment intent retrieval failed: ${error.message}`);
  }
};

/**
 * Handle Stripe webhook
 * @param {Object} webhookData - Webhook payload from Stripe
 * @param {string} signature - Stripe signature for verification
 * @returns {Object} Webhook processing response
 */
const handleStripeWebhook = async (webhookData, signature) => {
  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(webhookData, signature, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      throw new Error('Invalid webhook signature');
    }

    console.log('Processing Stripe webhook:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const reference = paymentIntent.metadata.reference;

        // Find transaction in database
        const transaction = await Transaction.findOne({
          'mpesaResponse.paymentIntentId': paymentIntent.id
        });

        if (!transaction) {
          console.log('Transaction not found for payment intent:', paymentIntent.id);
          return { success: false, message: 'Transaction not found' };
        }

        // Update transaction status
        transaction.mpesaResponse.status = 'completed';
        transaction.mpesaResponse.completedAt = new Date();
        transaction.mpesaResponse.stripeData = event.data.object;

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
        console.log('Payment completed successfully:', paymentIntent.id);
        return { success: true, message: 'Payment completed successfully' };

      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object;
        const failedReference = failedPaymentIntent.metadata.reference;

        const failedTransaction = await Transaction.findOne({
          'mpesaResponse.paymentIntentId': failedPaymentIntent.id
        });

        if (failedTransaction) {
          failedTransaction.mpesaResponse.status = 'failed';
          failedTransaction.mpesaResponse.failedAt = new Date();
          failedTransaction.mpesaResponse.stripeData = event.data.object;
          await failedTransaction.save();

          console.log('Payment failed:', failedPaymentIntent.id);
          return { success: false, message: 'Payment failed' };
        }
        break;

      default:
        console.log('Unhandled webhook event type:', event.type);
    }

    return { success: true, message: 'Webhook processed' };
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    return { success: false, message: `Webhook processing failed: ${error.message}` };
  }
};

/**
 * Initiate Stripe payment for loan fee
 * @param {Object} paymentData - Payment details
 * @param {number} paymentData.amount - Amount to charge
 * @param {string} paymentData.reference - Unique transaction reference
 * @param {Object} paymentData.metadata - Additional metadata
 * @returns {Object} Payment initiation response
 */
const initiateStripePayment = async (paymentData) => {
  try {
    const { amount, reference, metadata = {} } = paymentData;

    const result = await createPaymentIntent({
      amount,
      currency: 'kes',
      reference,
      metadata,
    });

    return {
      success: true,
      transactionId: result.paymentIntentId,
      clientSecret: result.clientSecret,
      amount,
      reference,
      status: 'pending',
      message: 'Stripe payment initiated successfully',
      provider: 'stripe',
    };
  } catch (error) {
    console.error('Stripe payment initiation error:', error);
    throw new Error(`Payment initiation failed: ${error.message}`);
  }
};

module.exports = {
  createPaymentIntent,
  confirmPaymentIntent,
  retrievePaymentIntent,
  handleStripeWebhook,
  initiateStripePayment,
  stripe, // Export Stripe instance for advanced usage
};