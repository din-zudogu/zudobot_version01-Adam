/**
 * svc_productEmbedding — RAG pipeline using Gemini text-embedding-004
 *
 * Atlas Vector Search index required (create once in Atlas UI):
 *   Collection : products
 *   Index name : zudobot_product_embedding
 *   Fields:
 *     { type: "vector", path: "embedding", numDimensions: 768, similarity: "cosine" }
 *     { type: "filter", path: "tenantId" }
 *     { type: "filter", path: "isActive" }
 *
 * Fallback: if Atlas not configured or no embeddings yet, falls back to
 * MongoDB text-index search then plain active-product fetch.
 */

import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ProductModel from "@/models/product";
import type { ProductContext } from "@/lib/ai/geminiClient";

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
const ATLAS_INDEX     = "zudobot_product_embedding";

// ─── Text builder ─────────────────────────────────────────────────────────────

export function buildEmbeddingText(p: {
  name: string;
  shortDescription?: string;
  price?: number;
  priceSuffix?: string;
  variants?: string[];
}): string {
  const priceStr = p.price === undefined
    ? ""
    : p.price === -1 ? "ติดต่อสอบถาม"
    : p.price === 0  ? "ฟรี"
    : `฿${p.price.toLocaleString()}${p.priceSuffix || ""}`;

  const parts = [
    `สินค้า: ${p.name}`,
    p.shortDescription ? `รายละเอียด: ${p.shortDescription}` : "",
    priceStr            ? `ราคา: ${priceStr}` : "",
    p.variants?.length  ? `ตัวเลือก: ${p.variants.join(", ")}` : "",
  ].filter(Boolean);

  return parts.join("\n");
}

// ─── Single embed ─────────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const genAI  = new GoogleGenerativeAI(apiKey);
  const model  = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ─── Embed one product and persist ───────────────────────────────────────────

export async function embedProduct(productId: string): Promise<boolean> {
  const product = await ProductModel.findById(productId);
  if (!product) return false;
  try {
    const text      = buildEmbeddingText(product);
    const embedding = await embedText(text);
    await ProductModel.updateOne(
      { _id: productId },
      { $set: { embedding, embeddedAt: new Date() } }
    );
    return true;
  } catch {
    return false;
  }
}

// ─── Batch re-embed all products for a tenant ─────────────────────────────────

export async function batchEmbedProducts(tenantId: string): Promise<{ total: number; done: number; failed: number }> {
  const products = await ProductModel.find({ tenantId }).select("_id name shortDescription price priceSuffix variants").lean();
  let done = 0, failed = 0;

  for (const p of products) {
    try {
      const text      = buildEmbeddingText(p);
      const embedding = await embedText(text);
      await ProductModel.updateOne({ _id: p._id }, { $set: { embedding, embeddedAt: new Date() } });
      done++;
    } catch {
      failed++;
    }
    // Small delay to avoid hitting rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  return { total: products.length, done, failed };
}

// ─── RAG semantic search ──────────────────────────────────────────────────────

export async function searchProductsByQuery(
  tenantId: string,
  query: string,
  limit = 5
): Promise<ProductContext[]> {
  const tid = new mongoose.Types.ObjectId(tenantId);

  // 1️⃣ Try Atlas $vectorSearch
  try {
    const queryEmbedding = await embedText(query);
    const docs = await ProductModel.aggregate([
      {
        $vectorSearch: {
          index:       ATLAS_INDEX,
          path:        "embedding",
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit,
          filter: { tenantId: tid, isActive: true },
        },
      },
      {
        $project: {
          name: 1, price: 1, priceSuffix: 1, shortDescription: 1,
          slug: 1, stock: 1, variants: 1,
          _score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    if (docs.length > 0) return docsToContext(docs);
  } catch {
    // Atlas Vector Search not available — fall through
  }

  // 2️⃣ Fallback: MongoDB text-index search
  try {
    const docs = await ProductModel
      .find({ tenantId: tid, isActive: true, $text: { $search: query } })
      .select("name price priceSuffix shortDescription slug stock variants")
      .limit(limit)
      .lean();
    if (docs.length > 0) return docsToContext(docs);
  } catch {
    // Text index not available — fall through
  }

  // 3️⃣ Last resort: return newest active products
  const docs = await ProductModel
    .find({ tenantId: tid, isActive: true })
    .select("name price priceSuffix shortDescription slug stock variants")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docsToContext(docs);
}

function docsToContext(docs: Array<Record<string, unknown>>): ProductContext[] {
  return docs.map((d) => ({
    name:             String(d.name || ""),
    price:            Number(d.price ?? 0),
    suffix:           String(d.priceSuffix || ""),
    shortDescription: String(d.shortDescription || ""),
    slug:             String(d.slug || ""),
    stock:            d.stock != null ? Number(d.stock) : undefined,
    variants:         Array.isArray(d.variants) ? (d.variants as string[]) : [],
  }));
}
