import { z } from 'zod';

// Auth Schemas
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

// Log Schemas
export const SeverityEnum = z.enum(['critical', 'high', 'medium', 'low', 'info']);

export const CreateLogSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  severity: SeverityEnum,
  message: z.string().min(1, 'Message is required'),
  ip: z.ipv4('Invalid IP address'),
  user: z.string().optional(),
  action: z.string().min(1, 'Action is required'),
  details: z.record(z.any(),z.any()).optional(),
});

export const FilterLogSchema = z.object({
  severity: SeverityEnum.optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
});

// Incident Schemas
export const IncidentSeverityEnum = z.enum(['critical', 'high', 'medium', 'low']);
export const IncidentStatusEnum = z.enum(['open', 'investigating', 'resolved', 'closed']);

export const CreateIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  severity: IncidentSeverityEnum,
  affectedSystems: z.array(z.string()).min(1, 'At least one affected system is required'),
  description: z.string().min(1, 'Description is required'),
  assignedTo: z.string().email().optional(),
  tags: z.array(z.string()).optional().default([]),
});

export const UpdateIncidentSchema = z.object({
  status: IncidentStatusEnum.optional(),
  assignedTo: z.string().email().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  affectedSystems: z.array(z.string()).optional(),
}).partial();

export const FilterIncidentSchema = z.object({
  status: IncidentStatusEnum.optional(),
  severity: IncidentSeverityEnum.optional(),
});

// Types
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreateLogInput = z.infer<typeof CreateLogSchema>;
export type FilterLogInput = z.infer<typeof FilterLogSchema>;
export type CreateIncidentInput = z.infer<typeof CreateIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentSchema>;
export type FilterIncidentInput = z.infer<typeof FilterIncidentSchema>;