const express = require('express');
const { body } = require('express-validator');
const aiController = require('../controllers/aiController');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(requireAuth);
router.use(aiLimiter);

router.post(
  '/explain',
  [
    body('repositoryId').isMongoId().withMessage('repositoryId must be a valid id'),
    body('filePath').trim().notEmpty().withMessage('filePath is required'),
  ],
  validate,
  aiController.explainFile
);

router.post(
  '/explain-cycle',
  [
    body('repositoryId').isMongoId().withMessage('repositoryId must be a valid id'),
    body('cycleId').trim().notEmpty().withMessage('cycleId is required'),
  ],
  validate,
  aiController.explainCycle
);

router.post(
  '/chat',
  [
    body('repositoryId').isMongoId().withMessage('repositoryId must be a valid id'),
    body('message').trim().notEmpty().withMessage('message is required'),
  ],
  validate,
  aiController.chat
);

router.get('/chat/:repositoryId', aiController.getChatHistory);
router.delete('/chat/:repositoryId', aiController.resetChat);

router.post(
  '/readme',
  [body('repositoryId').isMongoId().withMessage('repositoryId must be a valid id')],
  validate,
  aiController.generateReadme
);

router.post(
  '/readme/refine',
  [
    body('repositoryId').isMongoId().withMessage('repositoryId must be a valid id'),
    body('instruction').trim().notEmpty().withMessage('instruction is required').isLength({ max: 2000 }),
  ],
  validate,
  aiController.refineReadme
);

module.exports = router;
