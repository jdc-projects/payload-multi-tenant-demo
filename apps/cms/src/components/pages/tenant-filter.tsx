import type { Payload } from "payload";

type TenantFilterProps = { payload: Payload };

export default async function TenantFilter({ payload }: TenantFilterProps) {
  const tenants = await payload.find({
    collection: "tenants",
    depth: 0,
    limit: 100,
    overrideAccess: true,
    sort: "name",
  });
  const linkStyle = {
    border: "1px solid var(--theme-elevation-150)",
    borderRadius: "4px",
    display: "inline-block",
    padding: "8px 12px",
    textDecoration: "none",
  };

  return (
    <nav aria-label="Filter pages by tenant" style={{ marginBottom: "24px" }}>
      <p style={{ marginBottom: "8px" }}>
        <strong>Tenant pages</strong>
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <a href="/admin/collections/pages" style={linkStyle}>
          All tenants
        </a>
        {tenants.docs.map((tenant) => {
          const id = String(tenant.id);
          return (
            <a
              href={`/admin/collections/pages?where%5Btenant%5D%5Bequals%5D=${encodeURIComponent(id)}`}
              key={id}
              style={linkStyle}
            >
              {tenant.name}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
