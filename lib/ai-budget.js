// Spending safeguard: records the estimated cost of every AI call and switches the site to
// library-only once this calendar month's spend reaches the budget.
//
// Change the budget without touching code: set CHATEAT_AI_MONTHLY_BUDGET (in US dollars) in .env.local
// and in Vercel. This is ChatEAT's own estimate; also set a hard spend limit in the Anthropic Console.
import { sql } from "./db.js";

export const MONTHLY_BUDGET_USD = Number(process.env.CHATEAT_AI_MONTHLY_BUDGET ?? 5);

// Anthropic list prices in US dollars per million tokens: [input, output].
const PRICES = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};
// Unknown models are priced like the most expensive one, so the estimate never runs low.
const FALLBACK_PRICE = [4, 20];

// Cache writes cost 1.25x input and cache reads 0.1x input. Output tokens include the model's thinking.
export function estimateCost(model, usage = {}) {
  const [inputPrice, outputPrice] = PRICES[model] ?? FALLBACK_PRICE;
  const input =
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * 0.1;
  return (input * inputPrice + (usage.output_tokens ?? 0) * outputPrice) / 1_000_000;
}

export async function recordUsage(model, usage) {
  const inputTokens = (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0);
  await sql`
    insert into ai_usage (model, input_tokens, output_tokens, cost_usd)
    values (${model}, ${inputTokens}, ${usage?.output_tokens ?? 0}, ${estimateCost(model, usage)})`;
}

export async function spentThisMonth() {
  const [{ total }] = await sql`
    select coalesce(sum(cost_usd), 0)::float as total
    from ai_usage
    where created_at >= date_trunc('month', now())`;
  return total;
}

// True while this month's estimated spend is under the budget.
export async function underBudget() {
  if (!(MONTHLY_BUDGET_USD > 0)) return false;
  return (await spentThisMonth()) < MONTHLY_BUDGET_USD;
}

// AI requests allowed per person in any rolling 7 days. Library answers are free and don't count.
export const WEEKLY_AI_LIMIT = 50;

export async function aiUsesThisWeek(userId) {
  const [{ count }] = await sql`select count(*)::int as count from recipe_requests where user_id = ${userId} and mode = 'ai' and created_at > now() - interval '7 days'`;
  return count;
}
