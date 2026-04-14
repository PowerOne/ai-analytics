import { redirect } from "next/navigation";

/** Legacy path; primary admin home is the full dashboard. */
export default function AdminRootPage() {
  redirect("/admin/dashboard");
}
