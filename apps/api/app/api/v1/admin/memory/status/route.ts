/**
 * GET /api/v1/admin/memory/status
 * Checks if the Atlas Vector Search index "zudobot_visitor_memory" is ready.
 * Returns indexed flag, setup instructions when missing, and current memory usage.
 * Auth: x-secret-key only.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import mongoose from "mongoose";
import VisitorMemoryEntryModel from "@/models/visitorMemoryEntry";
import TenantUsageModel from "@/models/tenantUsage";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || auth.keyType !== "secret") {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  await dbConnect();
  const tenantId = new mongoose.Types.ObjectId(String(auth.tenant._id));

  // Probe the vector search index with a zero-vector query.
  // Atlas throws a specific error when the index doesn't exist or isn't ready.
  let indexed = false;
  let indexError: string | undefined;

  try {
    await VisitorMemoryEntryModel.aggregate([
      {
        $vectorSearch: {
          index:       "zudobot_visitor_memory",
          path:        "embedding",
          queryVector: new Array(768).fill(0),
          numCandidates: 1,
          limit:       1,
          filter:      { tenantId },
        },
      },
      { $limit: 1 },
    ]);
    indexed = true;
  } catch (e) {
    indexError = e instanceof Error ? e.message : String(e);
  }

  const usage = await TenantUsageModel.findOne({ tenantId }).lean();

  return NextResponse.json({
    ok: true,
    data: {
      indexed,
      indexError: indexed ? undefined : indexError,
      usedVisitorMemory:       usage?.usedVisitorMemory       ?? 0,
      totalVisitorMemoryQuota: usage?.totalVisitorMemoryQuota ?? 0,
      isMemoryFull:            usage?.isMemoryFull            ?? false,
      // Exact spec to paste into the Atlas UI when indexed === false
      setupInstructions: indexed ? null : {
        step1: "MongoDB Atlas → your cluster → Search Indexes → Create Search Index",
        step2: "Choose 'Atlas Vector Search' (not Atlas Search)",
        step3: "Select database and collection: ZDBMEM",
        indexDefinition: {
          name:   "zudobot_visitor_memory",
          type:   "vectorSearch",
          fields: [
            {
              type:          "vector",
              path:          "embedding",
              numDimensions: 768,
              similarity:    "cosine",
            },
            { type: "filter", path: "tenantId"  },
            { type: "filter", path: "visitorId" },
          ],
        },
      },
    },
  }, { headers: cors });
}
