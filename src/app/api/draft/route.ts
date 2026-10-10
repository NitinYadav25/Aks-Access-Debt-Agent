import { NextRequest, NextResponse } from 'next/server';
import { getAksService } from '../../../agent/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const aks = getAksService();

    // Call MCP tool through official client protocol
    const draft = await aks.client.callTool('create_remediation_draft', body);
    return NextResponse.json(draft);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
