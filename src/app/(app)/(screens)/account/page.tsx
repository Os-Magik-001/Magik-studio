import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/workflow";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ChangePasswordForm, NameForm } from "./forms";
import { WallpaperPicker } from "./wallpaper-picker";

export const metadata: Metadata = { title: "Settings" };

export default async function AccountPage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader title="Settings" description={`${viewer.email} · ${ROLE_LABEL[viewer.role]}`} />
      <div className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader title="Desktop" description="Your wallpaper, on this computer." />
          <div className="p-5">
            <WallpaperPicker />
          </div>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Name" description="How you appear on comments and assignments." />
          <div className="p-5">
            <NameForm fullName={viewer.fullName ?? ""} />
          </div>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Password" />
          <div className="p-5">
            <ChangePasswordForm />
          </div>
        </Card>
      </div>
    </>
  );
}
