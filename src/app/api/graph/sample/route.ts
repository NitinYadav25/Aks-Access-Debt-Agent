import { NextRequest, NextResponse } from 'next/server';
import { getAksService } from '../../../../agent/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dataset = body.dataset || 'enterprise';

    const aks = getAksService();

    if (dataset === 'baseline') {
      aks.resetToBaseline();
    } else {
      aks.loadEnterpriseData();
    }

    const stats = aks.getStats();

    return NextResponse.json({
      success: true,
      message: `Loaded dataset: ${dataset}`,
      stats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
