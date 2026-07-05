const express = require('express');
const { body } = require('express-validator');
const repositoryController = require('../controllers/repositoryController');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { analysisLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(requireAuth);

router.get('/', repositoryController.listRepositories);
router.get('/:id', repositoryController.getRepository);
router.delete('/:id', repositoryController.deleteRepository);

router.post(
  '/import',
  analysisLimiter,
  [
    body('githubUrl')
      .trim()
      .notEmpty()
      .withMessage('githubUrl is required')
      .matches(/^(https:\/\/github\.com\/|git@github\.com:)/)
      .withMessage('Must be a valid GitHub repository URL'),
  ],
  validate,
  repositoryController.importRepository
);

router.post('/:id/analyze', analysisLimiter, repositoryController.reanalyzeRepository);
router.get('/:id/graph', repositoryController.getRepositoryGraph);
router.get('/:id/architecture', repositoryController.getRepositoryArchitecture);
router.get('/:id/cycles', repositoryController.getRepositoryCycles);
router.get('/:id/metrics', repositoryController.getRepositoryMetrics);
router.get('/:id/metrics/history', repositoryController.getRepositoryMetricsHistory);
router.get('/jobs/:jobId', repositoryController.getAnalysisStatus);

module.exports = router;
