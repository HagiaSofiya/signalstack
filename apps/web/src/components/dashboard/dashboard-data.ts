export type DatasetItem = {
  id: string;
  filename: string;
  rows: string;
  updated: string;
  kind: string;
};

export type AgentRunItem = {
  id: string;
  question: string;
  status: "Completed" | "In progress" | "Queued";
  time: string;
  duration: string;
};

export const DEMO_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

export const recentDatasets: DatasetItem[] = [
  { id: "1", filename: "q3_revenue.csv", rows: "12,480 rows", updated: "Updated 2 hours ago", kind: "CSV" },
  { id: "2", filename: "customer_segments.csv", rows: "8,214 rows", updated: "Updated yesterday", kind: "CSV" },
  { id: "3", filename: "subscription_events.csv", rows: "42,910 rows", updated: "Updated Aug 28", kind: "CSV" },
];

export const recentAgentRuns: AgentRunItem[] = [
  { id: "1", question: "Which customer segments grew fastest in Q3?", status: "Completed", time: "Today, 10:42 AM", duration: "38 sec" },
  { id: "2", question: "Compare churn across the last four quarters", status: "In progress", time: "Today, 10:48 AM", duration: "Running" },
  { id: "3", question: "What explains the dip in August revenue?", status: "Queued", time: "Yesterday, 4:16 PM", duration: "Queued" },
];
