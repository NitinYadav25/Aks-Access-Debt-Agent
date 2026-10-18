import { NextResponse } from 'next/server';
import { getAksService } from '../../../agent/service';

export async function GET() {
  try {
    const aks = getAksService();
    const logs = aks.server.getAuditLogs();
    return NextResponse.json({
      total: logs.length,
      logs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
