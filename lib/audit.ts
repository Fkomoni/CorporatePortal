import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { Session } from 'next-auth';

export type AuditAction =
  | 'VIEW_MEMBERS'
  | 'EXPORT_MEMBERS'
  | 'VIEW_CLAIMS'
  | 'EXPORT_CLAIMS'
  | 'CHANGE_PASSWORD'
  | 'CHANGE_PASSWORD_FAILED'
  | 'VIEW_PORTAL_USERS'
  | 'TOGGLE_USER_STATUS'
  | 'VIEW_DASHBOARD'
  | 'VIEW_COMPANY_PROFILE'
  | 'VIEW_CORPORATES'
  | 'VIEW_CORPORATE_DETAIL'
  | 'SEND_SIGNUP_EMAIL'
  | 'VIEW_PORTAL_SETTINGS';

interface AuditContext {
  session: Session;
  action: AuditAction;
  resource: string;
  details?: Record<string, unknown>;
  request?: Request;
}

export async function logAudit({ session, action, resource, details, request }: AuditContext): Promise<void> {
  try {
    const user = session.user as {
      id?: string; name?: string; email?: string; role?: string;
      loginType?: string; companyId?: string; companyName?: string;
    };

    let ipAddress: string | undefined;
    let userAgent: string | undefined;
    if (request) {
      ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
        ?? request.headers.get('x-real-ip')
        ?? undefined;
      userAgent = request.headers.get('user-agent') ?? undefined;
    }

    await prisma.auditLog.create({
      data: {
        userId:      user.id      ?? null,
        userEmail:   user.email   ?? 'unknown',
        userName:    user.name    ?? 'Unknown',
        userRole:    user.role    ?? 'unknown',
        loginType:   user.loginType ?? 'unknown',
        companyId:   user.companyId   ?? null,
        companyName: user.companyName ?? null,
        action,
        resource,
        details:     details ? (details as Prisma.InputJsonValue) : undefined,
        ipAddress:   ipAddress ?? null,
        userAgent:   userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit failures must never break the main request
    console.error('[audit] Failed to write audit log:', err);
  }
}
