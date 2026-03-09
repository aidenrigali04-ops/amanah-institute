import { useState, useEffect } from "react";
import { getProfile } from "../api";

export interface ProfileState {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  displayName: string;
  username: string;
}

export function useProfile(): ProfileState {
  const [profile, setProfile] = useState<{ firstName?: string | null; lastName?: string | null; email?: string | null } | null>(null);

  useEffect(() => {
    getProfile()
      .then((p: { firstName?: string; lastName?: string; email?: string }) => setProfile(p))
      .catch(() => setProfile(null));
  }, []);

  const firstName = profile?.firstName ?? null;
  const lastName = profile?.lastName ?? null;
  const email = profile?.email ?? null;
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Member";
  const username = email ? `@${email.split("@")[0]}` : "@user";

  return { firstName, lastName, email, displayName, username };
}
