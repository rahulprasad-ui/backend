const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');
const authRoutes = require('./routes/auth.routes');
const healthRoutes = require('./routes/health.routes');
const verificationRoutes = require('./routes/verification.routes');
const VerificationController = require('./controllers/verification.controller');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');
const ApiError = require('./utils/apiError');

const AuthController = require('./controllers/auth.controller');

const secretKeyRoutes = require('./routes/secretKey.routes');

const app = express();

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// CORS Configuration
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-dev-uid', 'x-dev-email']
}));

// Body Parsers with payload limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global Rate Limiting
app.use(apiLimiter);

// Direct Link for Email Verification (e.g. /verify?token=...)
app.get('/verify', VerificationController.verifyToken);

// Direct Link for Password Reset Web Redirect (e.g. /reset?token=...&email=...)
app.get('/reset', AuthController.handleResetRedirect);

// Root Landing & Status Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Rivava-TrackFi-Backend-API',
    status: 'ONLINE',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      apiV1: '/api/v1'
    }
  });
});

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health Check (Root level)
app.use('/health', healthRoutes);

// Auth Routes (Direct level for backward compatibility)
app.use('/auth', authRoutes);

// Secret Key Management Routes
app.use('/api/keys', secretKeyRoutes);
app.use('/keys', secretKeyRoutes);

// Payment Gateway Routes
const paymentRoutes = require('./routes/payment.routes');
app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);

// User Profile & Sync Routes
const userRoutes = require('./routes/user.routes');
app.use('/api/users', userRoutes);
app.use('/users', userRoutes);

// Versioned API Routes (/api/v1)
app.use('/api/v1', routes);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found.`));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
