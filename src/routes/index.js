const express = require('express');
const authRoutes = require('./auth.routes');
const healthRoutes = require('./health.routes');
const verificationRoutes = require('./verification.routes');
const eliteRoutes = require('./elite.routes');
const userRoutes = require('./user.routes');
const secretKeyRoutes = require('./secretKey.routes');
const paymentRoutes = require('./payment.routes');

const router = express.Router();

// Mount API Modules
router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/verification', verificationRoutes);
router.use('/elite', eliteRoutes);
router.use('/payments', paymentRoutes);
router.use('/users', userRoutes);
router.use('/keys', secretKeyRoutes);

module.exports = router;
