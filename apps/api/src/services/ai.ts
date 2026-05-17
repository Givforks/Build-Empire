import type { PreferredDate } from '../types.js';

type BriefPhase = 'pre-approval' | 'post-approval';

type BriefContext = {
  phase: BriefPhase;
  prompt: string;
  appointmentTopic?: string;
  appointmentStatus?: string;
  preferredDates?: PreferredDate[];
  superuser?: {
    fullName?: string;
    rank?: string;
    specializations?: string[];
  };
};

function formatPreferredDates(preferredDates?: PreferredDate[]) {
  if (!preferredDates?.length) return 'Timeline to be confirmed.';

  return preferredDates
    .map((item) => {
      const slots = item.timeSlots.length > 0 ? item.timeSlots.join(', ') : 'time TBD';
      return `${item.date} at ${slots}`;
    })
    .join('; ');
}

export function buildMeetingBrief(input: BriefContext) {
  const summary =
    input.prompt.trim() || input.appointmentTopic?.trim() || 'No client request provided yet.';
  const topic = input.appointmentTopic?.trim() || summary;
  const specializations = input.superuser?.specializations?.length
    ? input.superuser.specializations.join(', ')
    : 'General advisory';
  const advisor = input.superuser?.fullName
    ? `${input.superuser.fullName}${input.superuser.rank ? ` (${input.superuser.rank})` : ''}`
    : 'Superuser';

  const lines = ['# Meeting Brief', '', '## Client Request Summary', summary];

  if (input.phase === 'post-approval') {
    lines.push(
      '',
      '## Key Topics',
      `- Core objective and context: ${topic}`,
      `- Expected outcomes from the appointment: arrive with a concrete recommendation from ${advisor}`,
      `- Constraints, timeline, and risks: ${formatPreferredDates(input.preferredDates)}${input.appointmentStatus ? ` | Status: ${input.appointmentStatus}` : ''}`,
      '',
      '## Suggested Questions for Superuser',
      '1. What is the highest impact next step?',
      '2. What should be prioritized in the next 30 days?',
      '3. What trade-offs should be avoided?',
      '',
      '## Proposed Agenda',
      '1. Context',
      '2. Deep discussion',
      '3. Recommendations',
      '4. Action plan',
      '',
      '## Recommended Answers',
      `- Highest impact next step: align the appointment around the one decision that moves ${topic.toLowerCase()} forward fastest.`,
      `- Prioritize in the next 30 days: sequence work around the advisor's specialization in ${specializations} and the earliest feasible dates.`,
      `- Trade-offs to avoid: do not expand scope, delay ownership, or lose the timeline signal from the approved brief.`
    );
  }

  return lines.join('\n');
}
