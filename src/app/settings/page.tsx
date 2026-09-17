import { Shell } from "@/components/workspace/shell";
import { SignOut } from "@/components/workspace/sign-out";
import { requireUser } from "@/server/auth";
import { LockKeyhole, Mail, Search, Users } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const user = await requireUser();
  return (
    <Shell active="settings" name={user.name}>
      <h1 className="text-[27px] font-semibold">Your workspace</h1>
      <p className="mt-2 mb-7 text-sm text-muted-foreground">
        Account details and what’s coming next.
      </p>
      <section className="panel mb-6 p-6">
        <div className="mb-5 flex items-center gap-2 font-semibold">
          <LockKeyhole size={18} className="text-primary" />
          Account
        </div>
        <dl className="mb-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Name</dt>
            <dd className="mt-1">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="mt-1">{user.email}</dd>
          </div>
        </dl>
        <SignOut />
      </section>
      <section className="panel p-6">
        <h2 className="font-semibold">On the roadmap</h2>
        <p className="mt-1 mb-5 text-xs text-muted-foreground">
          These integrations are planned and are not connected.
        </p>
        <div className="space-y-5">
          {[
            {
              icon: Search,
              name: "Automated job discovery",
              note: "Hourly search profiles and discovered opportunities · Week 2",
            },
            {
              icon: Mail,
              name: "Outlook email sync",
              note: "Opt-in status signals and a review queue · Week 3",
            },
            {
              icon: Users,
              name: "Networking assistant",
              note: "Contact context and editable outreach drafts · Week 3",
            },
          ].map((item) => (
            <div key={item.name} className="flex items-start gap-3">
              <span className="rounded-lg bg-secondary p-2 text-primary">
                <item.icon size={18} />
              </span>
              <div>
                <p className="text-xs font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.note}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
