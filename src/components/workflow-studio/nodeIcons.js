import { Zap, Bot, Sparkles, Wrench, GitBranch, Merge, Repeat, UserCheck, ArrowRightLeft, Flag, ListPlus, Split, ShieldAlert, Workflow, ScanText, BookOpen, Globe, Bell } from "lucide-react";

/** One icon per node type, shared by the palette and the next-step chips. */
export const NODE_ICONS = {
  trigger: Zap,
  agent: Bot,
  classifier: Sparkles,
  tool: Wrench,
  router: GitBranch,
  merge: Merge,
  loop: Repeat,
  approval: UserCheck,
  try: ShieldAlert,
  subworkflow: Workflow,
  convert: ArrowRightLeft,
  output: Flag,
  http: Globe,
  notification: Bell,
  extract: ScanText,
  rag: BookOpen,
  set: ListPlus,
  condition: Split,
};
