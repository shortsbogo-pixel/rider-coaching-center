export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
