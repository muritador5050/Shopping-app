const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controllers');
const { authenticate } = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/roleMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validation } = require('../middlewares/validation.middleware');
const { register, login } = require('../services/auth.validation');
const { avatarUpload, handleUploadError } = require('../utils/FileUploads');

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

// Registration routes
/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegister'
 *           examples:
 *             regularUser:
 *               summary: Regular user registration
 *               value:
 *                 name: John Doe
 *                 email: johndoe@example.com
 *                 password: SecurePassword123!
 *                 phone: '+1234567890'
 *                 role:
 *                   default: customer
 *             adminUser:
 *               summary: Admin user creation
 *               value:
 *                 name: Admin User
 *                 email: admin@example.com
 *                 password: AdminPassword123!
 *                 role: admin
 *             vendorUser:
 *               summary: Vendor user creation
 *               value:
 *                 name: Vendor User
 *                 email: vendoremail@example.com
 *                 password: VendorSecurePassword123!
 *                 role: vendor
 *     responses:
 *       '201':
 *         description: |
 *              User created successfully.
 *              Please check your email for verification.
 *              If you don't see it, please check your spam folder.
 *              Google signup verification is not required.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPublic'
 *       '400':
 *         description: Invalid input or user already exists
 */
router.post(
  '/register',
  validation(register),
  asyncHandler(UserController.registerUser)
);

router.post(
  '/vendor-register',
  validation(register),
  asyncHandler(UserController.registerVendorUser)
);

// Login routes
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *      - Auth
 *     summary: Login registered user
 *     requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/UserLogin"
 *   responses:
 *       200:
 *         content:
 *            accessToken:
 *               type: string
 *               example: hjuy574h47hfhfb367fbb290vbiuf9hgf
 */
router.post(
  '/login',
  validation(login),
  asyncHandler(UserController.loginUser)
);

// Google OAuth routes
router.get('/google-signup', UserController.googleAuth);
router.get('/google/callback', UserController.googleCallback);

// Token management routes
/**
 * @openapi
 * /api/auth/refresh-token:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Refresh access token using refresh token
 *     responses:
 *       200:
 *         description: Access token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 */
router.post('/refresh-token', asyncHandler(UserController.refreshToken));

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Logout user and clear refresh token and cookies
 *     responses:
 *       200:
 *         description: User logged out successfully
 */
router.post('/logout', asyncHandler(UserController.logOut));

// Password reset routes
/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Request password reset link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset link sent to email
 */
router.post('/forgot-password', asyncHandler(UserController.forgotPassword));

/**
 * @openapi
 * /api/auth/reset-password/{token}:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Reset password using reset token
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post(
  '/reset-password/:token',
  asyncHandler(UserController.resetPassword)
);

// Email verification routes
/**
 * @openapi
 * /api/auth/verify-email/{token}:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Verify user email using verification token
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
router.get(
  '/verify-email/:token',
  asyncHandler(UserController.emailVerification)
);

// ============================================================================
// AUTHENTICATED ROUTES (Require authentication)
// ============================================================================

// Profile routes
/**
 * @openapi
 * /api/auth/profile:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPublic'
 */
router.get(
  '/profile',
  authenticate,
  asyncHandler(UserController.getUserProfile)
);

// Avatar management routes
router.post(
  '/users/avatar',
  authenticate,
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      next();
    });
  },
  asyncHandler(UserController.uploadAvatar)
);

router.delete(
  '/delete-avatar',
  authenticate,
  asyncHandler(UserController.deleteAvatar)
);

// Email verification for authenticated users
router.post(
  '/resend-verification',
  authenticate,
  asyncHandler(UserController.resendEmailVerification)
);

// User online/offline status routes
router.post(
  '/heartbeat',
  authenticate,
  asyncHandler(UserController.updateUserHeartbeat)
);

router.post(
  '/online',
  authenticate,
  asyncHandler(UserController.setUserOnline)
);

router.post(
  '/offline',
  authenticate,
  asyncHandler(UserController.setUserOffline)
);

// User self-management routes
router.patch(
  '/users/:id/deactivate',
  authenticate,
  asyncHandler(UserController.deactivateUser)
);

// ============================================================================
// ADMIN ROUTES (Require admin role)
// ============================================================================

// User management routes for admins
/**
 * @openapi
 * /api/auth/users:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get all users (Admin only)
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserPublic'
 */
router.get(
  '/users',
  authenticate,
  checkRole('admin', 'read'),
  asyncHandler(UserController.getAllUsers)
);

router.get(
  '/online-users',
  authenticate,
  checkRole('admin', 'read'),
  asyncHandler(UserController.getOnlineUsers)
);

// Individual user management by admin
router.get(
  '/users/:id/status',
  authenticate,
  asyncHandler(UserController.getUserStatus)
);

router.post(
  '/users/:id/invalidate-tokens',
  authenticate,
  asyncHandler(UserController.invalidateUserTokens)
);

router.patch(
  '/users/:id/activate',
  authenticate,
  checkRole('admin', 'edit'),
  asyncHandler(UserController.activateUser)
);

router.patch(
  '/verify-user/:id',
  authenticate,
  checkRole('admin', 'edit'),
  asyncHandler(UserController.verifyUserByAdmin)
);

/**
 * @openapi
 * /api/auth/users/{id}:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get user by ID (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPublic'
 */
router
  .route('/users/:id')
  .get(authenticate, asyncHandler(UserController.getUserById))
  .put(authenticate, asyncHandler(UserController.updateUserProfile))
  .delete(
    authenticate,
    checkRole('admin', 'delete'),
    asyncHandler(UserController.deleteUser)
  );

module.exports = router;
