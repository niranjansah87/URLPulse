export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <section>
      <h1>Batch</h1>
      <p>
        Batch ID: <code>{id}</code>
      </p>
      <div className="empty-state">
        <p>Batch detail and live progress arrive in the next implementation phase.</p>
      </div>
    </section>
  );
}
