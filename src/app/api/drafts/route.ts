import { NextRequest, NextResponse } from 'next/server';
import { getAksService } from '../../../agent/service';

export async function GET() {
  try {
    const aks = getAksService();
    const drafts = aks.server.getDraftStore().getAllDrafts();
    return NextResponse.json({
      total: drafts.length,
      drafts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { draft_id, status } = body;

    if (!draft_id || !status) {
      return NextResponse.json({ error: 'draft_id and status are required' }, { status: 400 });
    }

    const aks = getAksService();
    const updated = aks.server.getDraftStore().updateDraftStatus(draft_id, status);

    if (!updated) {
      return NextResponse.json({ error: `Draft not found: ${draft_id}` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      draft: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
