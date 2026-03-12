export function JsonLd({ schema }: { schema: Record<string, any> }) {
  // Security: Escape closing script tags to prevent XSS injection
  // via malicious content in CMS fields that could break out of the JSON-LD block.
  const safeJson = JSON.stringify(schema)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  );
}
