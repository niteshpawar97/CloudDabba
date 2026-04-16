import { body } from 'express-validator';

export const setupValidator = [
  body('domain').trim().notEmpty().withMessage('Domain is required'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Admin name is required').isLength({ max: 100 }),
];
