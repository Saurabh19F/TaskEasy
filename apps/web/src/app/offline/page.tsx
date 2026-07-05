'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">📡</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">You're offline</h1>
        <p className="text-muted-foreground text-sm mb-6">
          TaskEasy couldn't reach the server. Check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-contrast hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
