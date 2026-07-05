const express = require('express');

const router = express.Router();

router.use('/health', require('./healthRoutes'));
router.use('/auth', require('./authRoutes'));
router.use('/repositories', require('./repositoryRoutes'));

// Analysis trigger + graph/metrics reads are exposed under /repositories
// (see repositoryRoutes.js: POST /:id/analyze, GET /:id/graph, GET /:id/metrics).

router.use('/ai', require('./aiRoutes'));

module.exports = router;
