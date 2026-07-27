import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 pt-24">
        <h1 className="text-4xl font-extrabold tracking-tight">This page took a walk.</h1>
        <p className="mt-4 tx-muted">
          The link is broken or the page moved. Head back home and try again.
        </p>
        <Link href="/" className="btn-brand mt-8 rounded-xl px-6 py-3 font-semibold">
          Back to home
        </Link>
      </main>
      <Footer />
    </>
  );
}
