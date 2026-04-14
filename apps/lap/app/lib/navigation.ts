import type { UserRole } from "./roles";

export type NavItem = {
  href: string;
  label: string;
  /** Lucide-style name for icon mapping in the layout */
  icon: "home" | "users" | "layers" | "interventions";
};

const students: NavItem = {
  href: "/students",
  label: "Students",
  icon: "users",
};
const classes: NavItem = {
  href: "/classes",
  label: "Classes",
  icon: "layers",
};
const interventions: NavItem = {
  href: "/interventions",
  label: "Interventions",
  icon: "interventions",
};

const overviewLabel: Record<UserRole, string> = {
  ADMIN: "Admin dashboard",
  PRINCIPAL: "Principal dashboard",
  TEACHER: "Teacher dashboard",
};

export function getNavItemsForRole(role: UserRole): NavItem[] {
  const home: NavItem = {
    href: dashboardHomeHref(role),
    label: overviewLabel[role],
    icon: "home",
  };
  switch (role) {
    case "ADMIN":
    case "PRINCIPAL":
    case "TEACHER":
      return [home, students, classes, interventions];
  }
}

export type NavSection = { heading: string; items: NavItem[] };

/** Grouped sidebar: home vs operational areas. */
export function getNavSectionsForRole(role: UserRole): NavSection[] {
  const items = getNavItemsForRole(role);
  if (items.length === 0) return [];
  return [
    { heading: "Workspace", items: [items[0]] },
    { heading: "Records & support", items: items.slice(1) },
  ];
}

/** Short blurb under the product name in the sidebar. */
export function roleWorkspaceLabel(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "School administration";
    case "PRINCIPAL":
      return "School leadership";
    case "TEACHER":
      return "Classroom tools";
  }
}

export function dashboardHomeHref(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard";
    case "PRINCIPAL":
      return "/principal/dashboard";
    case "TEACHER":
      return "/teacher";
  }
}

export function roleDisplayName(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "PRINCIPAL":
      return "Principal";
    case "TEACHER":
      return "Teacher";
  }
}
