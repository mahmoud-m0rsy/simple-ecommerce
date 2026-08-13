const express = require('express');
const { createOrder, listMyOrders, getOrder } = require('../controllers/orderController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// All order routes require a valid JWT.
router.use(requireAuth);

router.post('/', createOrder);
router.get('/', listMyOrders);
router.get('/:id', getOrder);

module.exports = router;
