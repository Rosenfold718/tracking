"use client";

import dynamic from "next/dynamic";

const PoseTracker = dynamic(() => import("@/components/pose-tracker"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-muted-foreground">Загрузка приложения...</p>
      </div>
    </div>
  ),
});

export default function ClientWrapper() {
  return <PoseTracker />;
}