/** Server-side barrel for shared domain contracts plus database row types. */
export * from "../shared/domain";
export type { InsertUser, User } from "../drizzle/schema";
export type {
  MetricKey,
  DomainKey,
  Category,
  ScenarioKey,
  HeartRateContext,
} from "../shared/constants";
