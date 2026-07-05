import ClientWrapper from "@/components/client-wrapper";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <ClientWrapper />
      </div>
      <footer className="border-t py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            Построено на <strong>MoveNet</strong> (TensorFlow.js, Google) — AI-модель для отслеживания позы в реальном времени
          </p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Все вычисления выполняются в вашем браузере — данные не отправляются на сервер
          </p>
        </div>
      </footer>
    </main>
  );
}