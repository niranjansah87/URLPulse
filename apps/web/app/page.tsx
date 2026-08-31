import Link from "next/link";

export default function HomePage() {
  return (
    <section>
      <h1>URLPulse</h1>
      <p>Bulk URL health monitoring with reliable background processing and real-time progress.</p>
      <p>
        <Link href="/batches">View batches →</Link>
      </p>
    </section>
  );
}
