import { redirect } from "next/navigation";

/** Legacy path — canonical role picker is /select-role */
export default function RoleSelectPage() {
  redirect("/select-role");
}
