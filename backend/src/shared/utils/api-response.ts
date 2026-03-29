import { Response } from 'express';

interface ApiResponseData {
  success: boolean;
  message: string;
  data?: any;
  errors?: any[];
}

export function sendSuccess(res: Response, data: any = null, message = 'Success', statusCode = 200) {
  const response: ApiResponseData = { success: true, message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
}

export function sendError(res: Response, message = 'Internal Server Error', statusCode = 500, errors?: any[]) {
  const response: ApiResponseData = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
}

export function sendCreated(res: Response, data: any, message = 'Created successfully') {
  return sendSuccess(res, data, message, 201);
}
