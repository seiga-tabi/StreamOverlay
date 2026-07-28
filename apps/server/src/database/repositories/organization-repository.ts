import type { TenantContext } from "../tenant-context.js";
import { repositoryQuery, requireBoundedText, type RepositoryQueryable } from "./types.js";

type OrganizationRow = {
  id: string;
  display_name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type OrganizationRecord = Readonly<{
  id: string;
  displayName: string;
  status: "active" | "suspended" | "closed";
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}>;

function mapOrganization(row: OrganizationRow): OrganizationRecord {
  if (!["active", "suspended", "closed"].includes(row.status)) {
    throw new Error("Database organization status가 올바르지 않습니다.");
  }
  return Object.freeze({
    id: row.id,
    displayName: row.display_name,
    status: row.status as OrganizationRecord["status"],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(row.deleted_at === null ? {} : { deletedAt: row.deleted_at.toISOString() })
  });
}

export class OrganizationRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async create(context: TenantContext, displayName: string): Promise<OrganizationRecord> {
    const result = await repositoryQuery<OrganizationRow>(
      this.queryable,
      `INSERT INTO organizations (id, display_name)
       VALUES ($1, $2)
       RETURNING id, display_name, status, created_at, updated_at, deleted_at`,
      [context.organizationId, requireBoundedText(displayName, "displayName", 120)]
    );
    return mapOrganization(result.rows[0]!);
  }

  async find(context: TenantContext): Promise<OrganizationRecord | undefined> {
    const result = await repositoryQuery<OrganizationRow>(
      this.queryable,
      `SELECT id, display_name, status, created_at, updated_at, deleted_at
       FROM organizations
       WHERE id = $1 AND deleted_at IS NULL`,
      [context.organizationId]
    );
    return result.rows[0] ? mapOrganization(result.rows[0]) : undefined;
  }
}
