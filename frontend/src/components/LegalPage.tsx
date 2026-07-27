import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pt-16">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
        <div className="glass mt-8 rounded-3xl p-8 text-sm leading-relaxed tx-muted">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
