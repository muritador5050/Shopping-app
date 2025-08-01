const express = require('express');
const router = express.Router();
const VendorController = require('../controllers/vendor.controller');
const { authenticate } = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/roleMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');
const uploadVendorImages = require('../middlewares/uploadVendorImages');

// Public routes
router.get('/', asyncHandler(VendorController.getAllVendors));
router.get('/top', asyncHandler(VendorController.getTopVendors));

router.get(
  '/profile/completion',
  authenticate,
  checkRole('vendor', 'read'),
  asyncHandler(VendorController.getProfileCompletion)
);

router
  .route('/profile')
  .get(
    authenticate,
    checkRole('vendor', 'read'),
    asyncHandler(VendorController.getVendorProfile)
  )
  .post(
    authenticate,
    checkRole('vendor', 'create'),
    uploadVendorImages,
    asyncHandler(VendorController.updateVendorData)
  )
  .put(
    authenticate,
    checkRole('vendor', 'edit'),

    asyncHandler(VendorController.updateVendorData)
  );

// Settings management
router.put(
  '/settings/:settingType',
  authenticate,
  checkRole('vendor', 'edit'),
  uploadVendorImages,
  asyncHandler(VendorController.updateSettings)
);

// Document management routes
router.post(
  '/documents',
  authenticate,
  checkRole('vendor', 'create'),
  asyncHandler(VendorController.manageDocuments)
);

router.delete(
  '/documents/:documentId',
  authenticate,
  checkRole('vendor', 'delete'),
  asyncHandler(VendorController.manageDocuments)
);

// Admin routes
router.get(
  '/admin/list',
  authenticate,
  checkRole('admin', 'read'),
  asyncHandler(VendorController.getVendorsForAdmin)
);

// Account status toggle
router.put(
  '/toggle-status',
  authenticate,
  checkRole('vendor', 'edit'),
  asyncHandler(VendorController.toggleAccountStatus)
);

router.put(
  '/toggle-status/:id',
  authenticate,
  checkRole('admin', 'edit'),
  asyncHandler(VendorController.toggleAccountStatus)
);

router.put(
  '/admin/verify/:id',
  authenticate,
  checkRole('admin', 'edit'),
  asyncHandler(VendorController.updateVendorVerificationStatus)
);

// Statistics routes
router.get(
  '/stats/:type',
  authenticate,
  (req, res, next) => {
    const requiredRole = req.params.type === 'admin' ? 'admin' : 'vendor';
    checkRole(requiredRole, 'read')(req, res, next);
  },
  asyncHandler(VendorController.getStatistics)
);

router.get('/:id', asyncHandler(VendorController.getVendorById));

module.exports = router;
