import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (session?.isLoggedIn) {
    redirect("/admin/dashboard");
  } else {
    redirect("/login");
  }
}
