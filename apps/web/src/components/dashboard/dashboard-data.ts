export type AgentRunItem = {
  id: string;
  question: string;
  status: "Completed" | "In progress" | "Queued";
  time: string;
  duration: string;
};

export const DEMO_PROJECT_ID = "11111111-1111-4111-8111-111111111111";

export const recentAgentRuns: AgentRunItem[] = [
  { id: "1", question: "Which customer segments grew fastest in Q3?", status: "Completed", time: "Today, 10:42 AM", duration: "38 sec" },
  { id: "2", question: "Compare churn across the last four quarters", status: "In progress", time: "Today, 10:48 AM", duration: "Running" },
  { id: "3", question: "What explains the dip in August revenue?", status: "Queued", time: "Yesterday, 4:16 PM", duration: "Queued" },
];
