const mongoose = require('mongoose');
const Product = require('../models/product.model');
const { resSuccessObject } = require('../utils/responseObject');

//Products
class ProductsController {
  //Create new product(Admin only)
  static async createProduct(req, res) {
    if (req.body.categoryId) {
      req.body.category = new mongoose.Types.ObjectId(req.body.categoryId);
    }
    const product = await Product.create({ ...req.body });
    const populated = await Product.findById(product)
      .populate('category', 'name slug image')
      .select('-categoryId');

    res.json(
      resSuccessObject({
        message: 'Done',
        results: populated,
      })
    );
  }

  //Get all products
  //Get all products
  static async getAllProducts(req, res) {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      category,
      minPrice,
      maxPrice,
      search,
      isActive,
    } = req.query;

    const query = Product.find({ isDeleted: false })
      .activeFilter(isActive)
      .filterByCategory(category)
      .priceRangeFilter(minPrice, maxPrice)
      .searchByText(search);

    const [products, total] = await Promise.all([
      query
        .clone()
        .paginate({ page: parseInt(page), limit: parseInt(limit) })
        .sort(sort)
        .populate('category', 'name')
        .populate('vendor', 'name email'),
      query.clone().countDocuments(),
    ]);

    console.log('First product vendor:', products[0]?.vendor);

    return res.json({
      count: products.length,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
      results: products,
    });
  }
  //Get a single product
  static async getProductById(req, res) {
    const productId = res.params.id;

    if (!mongoose.Types.ObjectId(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID format',
      });
    }

    const product = await Product.findById(productId)
      .populate('categories', 'name')
      .populate('vendor', 'name email');

    if (!product || product.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    return res.json(
      resSuccessObject({
        results: product,
      })
    );
  }

  //Update product(Admin only)
  static async updateProduct(req, res) {
    const productId = req.params.id;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID format',
      });
    }
    const product = await Product.findOneAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('categories', 'name');

    if (!product || product.isDeleted) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found or deleted' });
    }

    return res.json(
      resSuccessObject({
        results: product,
      })
    );
  }

  //Delete product(Admin only)
  static async deleteProduct(req, res) {
    const productId = req.params.id;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID format',
      });
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      { isDeleted: true, isActive: false },
      { new: true }
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }
    return res
      .status(200)
      .json({ success: true, message: 'Product soft-deleted successfully' });
  }
}

module.exports = ProductsController;
