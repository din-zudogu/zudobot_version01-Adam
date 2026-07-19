/** Shared role-routing helpers (session roles from DB / NextAuth JWT). */

export type SessionUserRoles = {
  role?: string;
  roles?: string[];
  onboardingComplete?: boolean;
};

export function getEffectiveRoles(user: SessionUserRoles): string[] {
  const role = user.role ?? "";
  const roles = user.roles ?? [];
  return roles.length ? roles : role ? [role] : [];
}

export function hasPartnerAccess(effectiveRoles: string[]): boolean {
  return effectiveRoles.includes("partner_admin");
}

export function hasTenantRole(effectiveRoles: string[]): boolean {
  return effectiveRoles.includes("tenant");
}

/** Tenant dashboard is available when role is tenant or onboarding finished. */
export function hasTenantDashboardAccess(user: SessionUserRoles): boolean {
  const effectiveRoles = getEffectiveRoles(user);
  if (!hasTenantRole(effectiveRoles)) return false;
  const role = user.role ?? "";
  return role === "tenant" || !!user.onboardingComplete;
}

export function needsDualRoleSelect(user: SessionUserRoles): boolean {
  const effectiveRoles = getEffectiveRoles(user);
  return hasPartnerAccess(effectiveRoles) && hasTenantDashboardAccess(user);
}

/** null = show dual-role UI; undefined = caller handles pending/admin separately */
export function getAutoRedirectPath(user: SessionUserRoles): string | null | undefined {
  const role = user.role ?? "";
  if (role === "super_admin" || role === "admin") return "/admin/tenants";
  if (role === "pending") return undefined;

  const effectiveRoles = getEffectiveRoles(user);
  const isPartner = hasPartnerAccess(effectiveRoles);
  const isTenant = hasTenantDashboardAccess(user);

  if (needsDualRoleSelect(user)) return null;

  if (isPartner) return "/partner/overview";
  if (isTenant) return "/dashboard/overview";
  if (hasTenantRole(effectiveRoles) || role === "tenant") return "/onboarding";

  return "/dashboard/overview";
}
