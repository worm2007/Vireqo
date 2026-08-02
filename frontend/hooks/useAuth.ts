"use client";

import { clearSession, getCurrentUser, logout } from "@/lib/api";
import type { User } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const signOut = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  return { user, setUser, loading, signOut };
}
