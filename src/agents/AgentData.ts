import { Activity } from './ActivityAnimations.js';

export interface AgentInfo {
  id: string;
  name: string;
  activity: Activity;
}

export const ACTIVITIES: Activity[] = [
  'idle',
  'planning',
  'implementing',
  'researching',
  'testing',
  'debugging',
  'reviewing',
  'writing_docs',
  'deploying',
  'meeting',
];

export const ACTIVITY_LABELS: Record<Activity, string> = {
  idle: '휴식 중',
  planning: '계획 중',
  implementing: '작업 중',
  researching: '조사 중',
  testing: '테스트 중',
  debugging: '오류 수정 중',
  reviewing: '검토 중',
  writing_docs: '문서 작성 중',
  deploying: '배포 중',
  meeting: '회의 중',
};

const AGENT_NAMES = [
  'Agent Alpha',
  'Agent Beta',
  'Agent Gamma',
  'Agent Delta',
  'Agent Epsilon',
];

const INITIAL_ACTIVITIES: Activity[] = [
  'implementing',
  'planning',
  'testing',
  'idle',
  'debugging',
];

export function getMockAgents(): AgentInfo[] {
  return AGENT_NAMES.map((name, i) => ({
    id: `agent_${i}`,
    name,
    activity: INITIAL_ACTIVITIES[i],
  }));
}

// Map activities to station types
export const ACTIVITY_STATION_MAP: Record<Activity, string> = {
  idle: 'idle',
  planning: 'planning',
  implementing: 'implementing',
  researching: 'researching',
  testing: 'testing',
  debugging: 'implementing', // uses desks too
  reviewing: 'reviewing',
  writing_docs: 'reviewing',
  deploying: 'implementing',
  meeting: 'meeting',
};
