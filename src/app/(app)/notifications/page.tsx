import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/lib/types";
import { NotificationsList } from "./NotificationsList";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<AppNotification[]>();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Notifications</h1>
      <NotificationsList notifications={notifications ?? []} />
    </div>
  );
}
