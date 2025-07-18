const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controllers');
const { authenticate } = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/roleMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validation } = require('../middlewares/validation.middleware');
const { register, login } = require('../services/auth.validation');

// Auth routes (no middleware needed)
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
  asyncHandler(UserController.createUser)
);

router.post(
  '/vendor-register',
  validation(register),
  asyncHandler(UserController.registerVendor)
);

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

//Google auth
router.get('/google-signup', UserController.googleAuth);
router.get('/google/callback', UserController.googleCallback);

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

// Profile route (authenticated users only)
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
  '/profile',
  authenticate,
  asyncHandler(UserController.getUserProfile)
);

router.get(
  '/users',
  authenticate,
  checkRole('admin', 'read'),
  asyncHandler(UserController.getAllUsers)
);

// User status and token management
router.get(
  '/users/:id/status',
  authenticate,
  asyncHandler(UserController.getUserStatus)
);

router.patch(
  '/users/:id/invalidate-tokens',
  authenticate,
  asyncHandler(UserController.invalidateUserTokens)
);

// User activation/deactivation (admin only)
router.patch(
  '/users/:id/deactivate',
  authenticate,
  asyncHandler(UserController.deactivateUser)
);

router.patch(
  '/users/:id/activate',
  authenticate,
  checkRole('admin', 'edit'),
  asyncHandler(UserController.activateUser)
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
  .put(authenticate, asyncHandler(UserController.updateUser))
  .delete(
    authenticate,
    checkRole('admin', 'delete'),
    asyncHandler(UserController.deleteUser)
  );

module.exports = router;
