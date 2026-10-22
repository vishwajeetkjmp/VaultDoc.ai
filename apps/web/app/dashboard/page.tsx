"use client";

import { Suspense } from "react";
import { useAuth, RequireAuth } from "../../components/AuthProvider";
import FilesApp from "../../components/files/FilesApp";

export default function DashboardPage() {
  return (
    <RequireAuth>
      {/* Suspense is required by Next.js for reading ?folder= from the URL */}
      <Suspense>
        <Files />
      </Suspense>
    </RequireAuth>
  );
}

function Files() {
  const { user } = useAuth();
  return user ? <FilesApp user={user} /> : null;
}
