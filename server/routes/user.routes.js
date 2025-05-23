const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controllers');
const { authenticate, isAdmin } = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validation } = require('../middlewares/validation.middleware');
const { register, login } = require('../services/auth.validation');

//Register and Login routes
router.post(
  '/register',
  validation(register),
  asyncHandler(UserController.createUser)
);
router.post(
  '/login',
  validation(login),
  asyncHandler(UserController.loginUser)
);
router.get(
  '/users',
  authenticate,
  isAdmin,
  asyncHandler(UserController.getAllUsers)
);

//Password reset routes
router.post(
  '/forgot-password',
  authenticate,
  asyncHandler(UserController.forgotPassword)
);
router.post(
  '/reset-password/:token',
  authenticate,
  asyncHandler(UserController.resetPassword)
);

//Email verification route
router.get(
  '/verify-email/:token',
  asyncHandler(UserController.emailVerification)
);

//oAuth route
router.get('/google', asyncHandler(UserController.googleAuth));
router.get('/google/callback', asyncHandler(UserController.googleCallback));
router.get('/test-google', asyncHandler(UserController.testGoogleAuth));
router.get('/facebook', asyncHandler(UserController.facebookAuth));
router.get('/facebook/callback', asyncHandler(UserController.facebookCallback));

//Logout
router.get('/logout', authenticate, asyncHandler(UserController.logOut));

router.get('/dashboard', authenticate, (req, res) => {
  res.status(200).json({ message: 'welcome to dashboard' });
});

router
  .route('/users/:id')
  .get(authenticate, asyncHandler(UserController.getUserById))
  .put(authenticate, asyncHandler(UserController.updateUser))
  .delete(authenticate, isAdmin, asyncHandler(UserController.deleteUser));

module.exports = router;
