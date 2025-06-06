const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const { resSuccessObject } = require('../utils/responseObject');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const axios = require('axios');
const { default: mongoose } = require('mongoose');

require('dotenv').config();

// Payment controller
class PaymentController {
  // Create a new payment
  static async createPayment(req, res) {
    const { order, paymentProvider, amount, currency } = req.body;

    // Validation
    if (!paymentProvider || !order || !amount) {
      return res.status(400).json({
        message:
          'Missing required fields: order, paymentProvider, and amount are required',
      });
    }

    if (!['stripe', 'paystack'].includes(paymentProvider)) {
      return res.status(400).json({
        message: 'Unsupported payment provider. Use "stripe" or "paystack"',
      });
    }

    // Check for existing payment
    const existingPayment = await Payment.findOne({
      order,
      status: { $in: ['completed', 'pending'] },
    });

    if (existingPayment) {
      return res.status(409).json({
        message: 'Payment already exists for this order',
      });
    }

    // Create payment based on provider
    const paymentData = await PaymentController.createProviderPayment(
      paymentProvider,
      amount,
      currency,
      order
    );

    // Save payment to database
    const payment = await Payment.create({
      order,
      paymentProvider,
      paymentId: paymentData.paymentId,
      amount,
      currency: paymentProvider === 'paystack' ? 'NGN' : currency,
      status: 'pending',
    });

    return res.json({
      results: payment,
      checkoutUrl: paymentData.checkoutUrl,
    });
  }

  // Helper method to create payment with different providers (fixed typo)
  static async createProviderPayment(provider, amount, currency, orderId) {
    const idempotencyKey = crypto.randomUUID();

    // FIXED: Use the orderId parameter that comes from request body
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    //Stripe
    if (provider === 'stripe') {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: currency.toLowerCase(),
                product_data: { name: 'Order Payment' },
                unit_amount: Math.round(amount * 100),
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
          metadata: {
            idempotencyKey,
            orderId: orderId.toString(),
          },
        });

        return {
          paymentId: session.id,
          checkoutUrl: session.url,
        };
      } catch (error) {
        console.error('Stripe error:', error);
        throw new Error(`Stripe payment creation failed: ${error.message}`);
      }
    }

    if (provider === 'paystack') {
      try {
        if (!process.env.PAYSTACK_SECRET_KEY) {
          throw new Error('PAYSTACK_SECRET_KEY is not configured');
        }

        // Ensure amount is in kobo (minimum 1 kobo = 0.01 NGN)
        const amountInKobo = Math.round(amount * 100);
        if (amountInKobo < 1) {
          throw new Error('Amount too small for Paystack (minimum 0.01 NGN)');
        }

        // Get customer email from order if available
        const customerEmail =
          order.customerEmail || order.user?.email || 'customer@example.com';

        const paymentData = {
          amount: amountInKobo,
          currency: 'NGN',
          email: customerEmail,
          reference: `order_${orderId}_${Date.now()}`, // NOW orderId is defined!
          callback_url: `${process.env.FRONTEND_URL}/payment-success`,
          metadata: {
            orderId: orderId.toString(),
            idempotencyKey,
          },
        };

        const response = await axios.post(
          'https://api.paystack.co/transaction/initialize',
          paymentData,
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        if (!response.data.status) {
          throw new Error(`Paystack API error: ${response.data.message}`);
        }

        const { reference, authorization_url } = response.data.data;

        if (!authorization_url) {
          throw new Error('Paystack did not return checkout URL');
        }

        return {
          paymentId: reference,
          checkoutUrl: authorization_url,
        };
      } catch (error) {
        console.error('Paystack error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });

        if (error.response?.data) {
          throw new Error(
            `Paystack API error: ${JSON.stringify(error.response.data)}`
          );
        }
        throw new Error(`Paystack payment creation failed: ${error.message}`);
      }
    }

    throw new Error('Unsupported payment provider');
  }

  // Process webhooks
  static async processWebhooks(req, res) {
    const paymentProvider = req.params;

    if (paymentProvider === 'stripe') {
      await PaymentController.handleStripeWebhook(req);
    } else if (paymentProvider === 'paystack') {
      await PaymentController.handlePaystackWebhook(req);
    } else {
      return res.status(400).json({ message: 'Unknown payment provider' });
    }

    return res.status(200).json({ message: 'Webhook processed successfully' });
  }

  // Handle Stripe webhooks
  static async handleStripeWebhook(req) {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    const session = event.data.object;
    const payment = await Payment.findOne({ paymentId: session.id });

    if (!payment) {
      throw new Error('Payment not found for session ID: ' + session.id);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await Promise.all([
          Payment.findByIdAndUpdate(payment._id, {
            status: 'completed',
            paidAt: new Date(),
            transactionDetails: JSON.stringify(session),
          }),
          Order.findByIdAndUpdate(payment.order, {
            paymentStatus: 'completed',
            orderStatus: 'processing',
          }),
        ]);
        break;

      case 'checkout.session.expired':
        await Payment.findByIdAndUpdate(payment._id, {
          status: 'failed',
          failureReason: 'Session expired',
          transactionDetails: JSON.stringify(session),
        });
        break;

      case 'charge.dispute.created':
        await Payment.findByIdAndUpdate(payment._id, {
          status: 'disputed',
          transactionDetails: JSON.stringify(session),
        });
        break;
    }
  }

  // Handle Paystack webhooks (fixed typo)
  static async handlePaystackWebhook(req) {
    // Verify webhook signature for security
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      throw new Error('Invalid webhook signature');
    }

    const { event, data } = req.body;
    const payment = await Payment.findOne({ paymentId: data.reference });

    if (!payment) {
      throw new Error('Payment not found for reference: ' + data.reference);
    }

    switch (event) {
      case 'charge.success':
        await Promise.all([
          Payment.findByIdAndUpdate(payment._id, {
            status: 'completed',
            paidAt: new Date(),
            transactionDetails: JSON.stringify(data),
          }),
          Order.findByIdAndUpdate(payment.order, {
            paymentStatus: 'completed',
            orderStatus: 'processing',
          }),
        ]);
        break;

      case 'charge.failed':
        await Payment.findByIdAndUpdate(payment._id, {
          status: 'failed',
          failureReason: data.gateway_response,
          transactionDetails: JSON.stringify(data),
        });
        break;
    }
  }

  // Get all payments
  static async getAllPayments(req, res) {
    const {
      status,
      orderId,
      paidAt,
      paymentProvider,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (orderId) filter.order = orderId; // Fixed: should be 'order' not 'orderId'
    if (paidAt) filter.paidAt = paidAt;
    if (paymentProvider) filter.paymentProvider = paymentProvider;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const payments = await Payment.find(filter) // Fixed: better variable naming
      .populate('order')
      .skip(skip)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const totalPayments = await Payment.countDocuments(filter);
    const numOfPages = Math.ceil(totalPayments / parseInt(limit));

    return res.json(
      resSuccessObject({
        results: payments,
        count: payments.length,
        totalPayments,
        numOfPages,
        currentPage: parseInt(page),
      })
    );
  }

  // Get payment by ID
  static async getPaymentById(req, res) {
    const payment = await Payment.findById(req.params.id).populate('order');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    return res.json(resSuccessObject({ results: payment }));
  }

  // Get user's own payments
  static async getUserPayments(req, res) {
    const userId = req.user.id;

    // Get all payments for this user
    const payments = await Payment.find({ user: userId })
      .populate([
        { path: 'order', select: 'orderNumber totalAmount' },
        { path: 'user', select: 'name email' },
      ])
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      resSuccessObject({
        message: 'User payments retrieved successfully',
        results: payments,
      })
    );
  }

  // Update payment status
  static async updatePaymentStatus(req, res) {
    const { status, paidAt } = req.body;
    const validStatuses = [
      'pending',
      'completed',
      'failed',
      'refunded',
      'disputed',
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        // Fixed: should be 400 not 404
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updateData = { status };
    if (paidAt) updateData.paidAt = paidAt;

    const payment = await Payment.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('order');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    return res.json(
      resSuccessObject({
        results: payment,
      })
    );
  }

  // Delete or Cancel payment
  static async deletePayment(req, res) {
    const payment = await Payment.findByIdAndDelete(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' }); // Fixed message
    }

    return res.json(
      resSuccessObject({
        message: 'Payment deleted successfully',
      })
    );
  }

  // Get user's payment analytics and statistics
  static async getPaymentAnalytics(req, res) {
    const userId = req.user.id;
    const { period = '12months' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate;

    switch (period) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6months':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '12months':
      default:
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }

    const matchStage = {
      user: new mongoose.Types.ObjectId(userId),
      createdAt: { $gte: startDate },
    };

    // Execute multiple aggregations in parallel
    const [
      overallStats,
      statusBreakdown,
      monthlyTrends,
      paymentMethodBreakdown,
      recentTransactions,
    ] = await Promise.all([
      // Overall statistics
      Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
            avgTransactionAmount: { $avg: '$amount' },
            maxTransactionAmount: { $max: '$amount' },
            minTransactionAmount: { $min: '$amount' },
            successfulPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            failedPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
            },
            pendingPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
          },
        },
      ]),

      // Payment status breakdown
      Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Monthly payment trends
      Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            totalAmount: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
            avgAmount: { $avg: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            year: '$_id.year',
            month: '$_id.month',
            monthName: {
              $arrayElemAt: [
                [
                  '',
                  'Jan',
                  'Feb',
                  'Mar',
                  'Apr',
                  'May',
                  'Jun',
                  'Jul',
                  'Aug',
                  'Sep',
                  'Oct',
                  'Nov',
                  'Dec',
                ],
                '$_id.month',
              ],
            },
            totalAmount: 1,
            transactionCount: 1,
            avgAmount: { $round: ['$avgAmount', 2] },
          },
        },
      ]),

      // Payment method breakdown
      Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' },
          },
        },
        { $sort: { count: -1 } },
        {
          $project: {
            _id: 0,
            paymentMethod: '$_id',
            count: 1,
            totalAmount: 1,
            avgAmount: { $round: ['$avgAmount', 2] },
            percentage: {
              $multiply: [{ $divide: ['$count', { $sum: '$count' }] }, 100],
            },
          },
        },
      ]),

      // Recent transactions (last 5)
      Payment.find(matchStage)
        .populate('order', 'orderNumber')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('amount status paymentMethod createdAt order transactionId')
        .lean(),
    ]);

    // Process overall stats
    const stats = overallStats[0] || {
      totalAmount: 0,
      totalTransactions: 0,
      avgTransactionAmount: 0,
      maxTransactionAmount: 0,
      minTransactionAmount: 0,
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
    };

    // Calculate success rate
    const successRate =
      stats.totalTransactions > 0
        ? ((stats.successfulPayments / stats.totalTransactions) * 100).toFixed(
            2
          )
        : 0;

    // Format the response
    const analytics = {
      period,
      dateRange: {
        startDate,
        endDate: now,
      },
      overview: {
        totalSpent: stats.totalAmount,
        totalTransactions: stats.totalTransactions,
        averageTransactionAmount:
          Math.round(stats.avgTransactionAmount * 100) / 100,
        largestTransaction: stats.maxTransactionAmount,
        smallestTransaction: stats.minTransactionAmount,
        successRate: `${successRate}%`,
      },
      paymentCounts: {
        successful: stats.successfulPayments,
        failed: stats.failedPayments,
        pending: stats.pendingPayments,
      },
      statusBreakdown,
      monthlyTrends,
      paymentMethodBreakdown,
      recentTransactions,
    };

    res.json(
      resSuccessObject({
        message: 'User payment analytics retrieved successfully',
        results: analytics,
      })
    );
  }
}

module.exports = PaymentController;
