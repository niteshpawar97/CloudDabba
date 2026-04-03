import { body } from 'express-validator';

export const createProjectValidator = [
  body('name').trim().notEmpty().withMessage('Project name is required').isLength({ max: 100 }),
  body('repoUrl').trim().notEmpty().withMessage('Repository URL is required'),
  body('branch').optional().trim().isLength({ max: 100 }),
  body('projectType').isIn(['NODE_BACKEND', 'REACT_FRONTEND', 'NEXTJS_APP', 'STATIC_SITE', 'FULLSTACK', 'CUSTOM_DOCKERFILE'])
    .withMessage('Invalid project type'),
  body('envVars').optional().isObject(),
];

export const updateProjectValidator = [
  body('name').optional().trim().isLength({ max: 100 }),
  body('branch').optional().trim().isLength({ max: 100 }),
  body('envVars').optional().isObject(),
];

export const envVarsValidator = [
  body('envVars').isObject().withMessage('envVars must be an object'),
];
