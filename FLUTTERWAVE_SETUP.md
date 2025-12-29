# Flutterwave Setup Guide for JAMII LOAN

## 🚀 Getting Started with Flutterwave

This guide will help you set up Flutterwave for live payments in your JAMII LOAN application.

## 📋 Prerequisites

1. **Flutterwave Account**: Sign up at [flutterwave.com](https://flutterwave.com)
2. **Business Verification**: Complete KYC verification on Flutterwave
3. **Kenyan Business**: Ensure your business is registered in Kenya

## 🔑 Step 1: Get Your API Credentials

### 1.1 Access API Settings
1. Log in to your [Flutterwave Dashboard](https://dashboard.flutterwave.com)
2. Navigate to **Settings** → **API**
3. You'll see your API keys in the **Live Data** section

### 1.2 Copy Your Keys
You'll need these three credentials:

```
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxxxxxxxxxxxxxxxxxxxx-X
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxxxxxxxxxxxxxxxxxxxx-X
FLUTTERWAVE_SECRET_HASH=your-webhook-secret-hash
```

> **⚠️ Important**: Use **Live** keys for production, not Test keys!

## 🌐 Step 2: Set Up Webhook

### 2.1 Create Webhook Endpoint
1. In Flutterwave Dashboard, go to **Settings** → **Webhooks**
2. Click **"Create Webhook"**
3. Set the **Webhook URL** to:
   ```
   https://yourdomain.com/api/payment/webhook/flutterwave
   ```
   Replace `yourdomain.com` with your actual domain.

4. Select these events:
   - ✅ `charge.completed`
   - ✅ `transfer.completed`
   - ✅ `transfer.failed`

### 2.2 Get Webhook Secret Hash
After creating the webhook, Flutterwave will provide a **Secret Hash**. Copy this - it's your `FLUTTERWAVE_SECRET_HASH`.

## ⚙️ Step 3: Configure Environment Variables

### 3.1 Create .env file
Copy the example file and add your credentials:

```bash
cp .env.example .env
```

### 3.2 Edit .env file
Add your Flutterwave credentials to the `.env` file:

```env
# Flutterwave Payment Gateway (REQUIRED FOR LIVE PAYMENTS)
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxxxxxxxxxxx-X
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxxxxxxxxxxxxxxx-X
FLUTTERWAVE_SECRET_HASH=your-webhook-secret-hash-here

# Other required variables...
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-jwt-secret
# ... etc
```

## 🧪 Step 4: Test Your Setup

### 4.1 Test Environment First
Before going live, test with Flutterwave's test environment:

```env
# Use test keys first
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxxxxxxxxxxxxxxxxxxxx-X
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxxxxxxxxxxxxxxxxxxxx-X
```

### 4.2 Test Payment Flow
1. Start your application: `npm run dev`
2. Apply for a loan
3. Try paying the processing fee
4. Use test payment details from Flutterwave documentation

### 4.3 Verify Webhook
Check your server logs to ensure webhooks are being received and processed correctly.

## 🚀 Step 5: Go Live

### 5.1 Switch to Live Keys
Replace test keys with live keys in your `.env` file:

```env
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxxxxxxxxxxx-X
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxxxxxxxxxxxxxxx-X
```

### 5.2 Update Webhook URL
Ensure your webhook URL points to your live domain, not localhost.

### 5.3 Deploy and Test
1. Deploy your application
2. Test a real payment with a small amount
3. Verify the payment flow works end-to-end

## 💳 Supported Payment Methods

With Flutterwave, your users can pay using:

- **M-PESA** (most popular in Kenya)
- **Airtel Money**
- **Credit/Debit Cards** (Visa, Mastercard)
- **Bank Transfers**
- **Mobile Money** (various providers)

## 🔧 Troubleshooting

### Common Issues:

1. **"Public Key required" error**
   - Check that `FLUTTERWAVE_PUBLIC_KEY` is set in your `.env` file

2. **Webhook not firing**
   - Verify webhook URL is accessible from the internet
   - Check webhook secret hash matches

3. **Payments not completing**
   - Ensure you're using live keys for live payments
   - Check Flutterwave dashboard for transaction status

### Support:
- **Flutterwave Support**: support@flutterwave.com
- **Documentation**: [Flutterwave Docs](https://developer.flutterwave.com/docs)

## 📞 Need Help?

If you encounter any issues:
1. Check the server logs for error messages
2. Verify all environment variables are set correctly
3. Test with Flutterwave's API documentation examples
4. Contact Flutterwave support with your merchant ID

---

**🎉 Congratulations!** Your JAMII LOAN system now supports live payments through Flutterwave without requiring M-PESA Daraja API registration.
