export type AgentLogMetadata = Readonly<Record<string, string | number | boolean | undefined>>;

export function agentEvent(type: string, metadata: AgentLogMetadata = {}): void {
  const safe = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
  process.stdout.write(`${JSON.stringify({ type, ...safe, at: new Date().toISOString() })}\n`);
}
