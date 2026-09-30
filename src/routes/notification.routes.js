const express = require('express');
const NotificationController = require('../controllers/notification.controller');

const router = express.Router();

router.post('/register-token', NotificationController.registerToken);
router.post('/send', NotificationController.sendNotification);

module.exports = router;
