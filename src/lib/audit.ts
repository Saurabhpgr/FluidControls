// Audit logging disabled per configuration
export async function logAudit(_params: { action: string; entity_type: string; entity_id?: string | null; details?: Record<string, unknown> }) {
  // No-op
}

