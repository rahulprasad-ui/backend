const express = require('express');
const UserController = require('../controllers/user.controller');
const { optionalAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/profile', optionalAuth, UserController.getProfile);
router.get('/me', optionalAuth, UserController.getProfile);
router.put('/profile', optionalAuth, UserController.updateProfile);
router.post('/sync', optionalAuth, UserController.updateProfile);

module.exports = router;
