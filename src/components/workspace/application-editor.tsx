"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { stageLabels, stages, type ApplicationRow } from "@/lib/application";
import { saveApplication } from "@/features/applications/actions";
export function ApplicationEditor({
  application,
  open,
  onClose,
}: {
  application?: ApplicationRow;
  open: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = Object.fromEntries(form.entries());
    setError("");
    startTransition(async () => {
      try {
        const result = await saveApplication(
          input,
          application
            ? { id: application.id, version: application.version }
            : undefined,
        );
        if (result.ok) {
          onClose();
          router.refresh();
        } else setError(result.error);
      } catch {
        setError(
          "Couldn’t reach the server. Your form is still here; please try again.",
        );
      }
    });
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle className="pr-8 text-xl font-semibold">
          {application ? "Edit application" : "A new opportunity"}
        </DialogTitle>
        <DialogDescription className="mt-2 mb-6 text-xs leading-relaxed text-muted-foreground">
          {application
            ? "Keep your application details and progress up to date."
            : "Add the details now. Keep the whole journey in one place."}
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={pending} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Company *</span>
                <input
                  className="field"
                  name="company"
                  required
                  maxLength={120}
                  defaultValue={application?.company}
                  placeholder="e.g. Linear"
                />
              </label>
              <label>
                <span className="label">Role *</span>
                <input
                  className="field"
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={application?.title}
                  placeholder="e.g. Frontend Engineer"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Location</span>
                <input
                  className="field"
                  name="location"
                  maxLength={160}
                  defaultValue={application?.location ?? ""}
                  placeholder="e.g. Singapore"
                />
              </label>
              <label>
                <span className="label">Work arrangement</span>
                <select
                  className="field"
                  name="workMode"
                  defaultValue={application?.workMode ?? "UNKNOWN"}
                >
                  <option value="UNKNOWN">Not specified</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ONSITE">On-site</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="label">Job URL</span>
              <input
                className="field"
                name="url"
                type="url"
                maxLength={2000}
                defaultValue={application?.url ?? ""}
                placeholder="https://…"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label>
                <span className="label">Stage *</span>
                <select
                  className="field"
                  name="stage"
                  defaultValue={application?.stage ?? "WISHLIST"}
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {stageLabels[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Applied on</span>
                <input
                  className="field"
                  type="date"
                  name="appliedAt"
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={application?.appliedAt?.slice(0, 10) ?? ""}
                />
              </label>
              <label>
                <span className="label">First response</span>
                <input
                  className="field"
                  type="date"
                  name="firstResponseAt"
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={
                    application?.firstResponseAt?.slice(0, 10) ?? ""
                  }
                />
              </label>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Submitted applications need an applied date. Screening, technical,
              and offer stages also need the date of the first meaningful
              response.
            </p>
            <label className="block">
              <span className="label">Notes</span>
              <textarea
                className="field min-h-24 resize-y"
                name="notes"
                maxLength={10000}
                defaultValue={application?.notes ?? ""}
                placeholder="People to follow up with, things to prepare, what excites you…"
              />
            </label>
          </fieldset>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-xs leading-relaxed text-rose-700"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : application
                  ? "Save changes"
                  : "Add application"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
