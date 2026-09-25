// All story content for the case study.
// Source of truth: the paper "Who Does What? Designing Collaboration Mechanics for
// Team-Based VR First Aid". Participant IDs follow the paper; the transcripts are
// used only for verbatim quotations. No names, places, ages or employers.
// Leave a link empty and the page shows it as "coming soon".

export const LINKS = {
  demo: '/demo/',
  paper: '/findings/',
  paperPdf: '',      // e.g. '/findings/who-does-what.pdf' once the PDF is added
  video: '',
  portfolio: 'https://uxabhi.com',
};

// Act II: why the interview guide was ordered the way it was
export const METHOD = [
  { k: 'Backbone', title: 'The rescue chain, not an invented flow', body: 'Secure, call, first aid, hand over. An evidence-based skeleton every expert already recognises, so the training could be judged against real practice.' },
  { k: 'Order', title: 'Experts before ideas', body: 'No VR design work started until we had heard from the people who do this work. Every design decision had to trace back to something that goes wrong at a real scene.' },
  { k: 'Discipline', title: 'Rescue chain first, VR last', body: 'Every interview opened with the rescue chain before VR was mentioned, so answers came from field experience, not excitement or scepticism about the technology.' },
];

// Act III: the six questions. `shift` lines are the team's before/after in thinking.
export const QUESTIONS = [
  {
    theme: 'The chain of rescue',
    q: 'What do you understand by the chain of rescue, and which steps fundamentally belong to it?',
    why: 'Asked first, before VR was mentioned, to get an uncoloured baseline of how each expert actually thinks about a response.',
    heard: [
      { t: 'Everything up to the emergency call is the most important thing, because the emergency services don’t drive around like police patrols.', p: 'P6' },
      { t: 'You can also divide up tasks so that one person checks how the people are doing and the other one… handles security measures.', p: 'P1' },
    ],
    assumed: 'The rescue chain is a checklist one helper works through.',
    learned: 'Even when describing the chain, experts talked about dividing it between people. The chain is a team process.',
  },
  {
    theme: 'Current training',
    q: 'How is teamwork and role distribution practised in current first aid courses?',
    why: 'Built to surface the gap from the people who teach and use first aid, not to assume it.',
    heard: [
      { t: 'In first aid courses, teamwork is simply not practised. Not at all.', p: 'Expert' },
      { t: 'No one feels directly addressed — the emergency call gets pushed back and forth in a group.', p: 'P6' },
    ],
    assumed: 'Courses cover teamwork lightly; VR could deepen it.',
    learned: 'Teamwork isn’t covered at all, and the most time-critical action, the call, is the one nobody owns. Diffusion of responsibility became the core problem.',
  },
  {
    theme: 'Classroom limits',
    q: 'Where do classroom methods, dummies and role-play reach their limits compared to a real situation?',
    why: 'To find exactly what a classroom cannot do, so VR would fill that hole instead of duplicating what already works.',
    heard: [
      { t: 'You practice in a dry environment and you do not see what you do not see — in reality you arrive and you do not know the injury pattern.', p: 'P2' },
      { t: 'One of the most important things people can learn is to take a mental step back, get an overview, and then act.', p: 'P3' },
    ],
    assumed: 'VR’s value is showing injuries more realistically.',
    learned: 'The missing piece is the chaotic phase: noise, traffic, uncertainty and tunnel vision, like bystanders pulling at a jammed door while the other side was open.',
  },
  {
    theme: 'Realism',
    q: 'Would VR training be convincing, and how much realism, including blood and screaming, is right?',
    why: 'The direct test of the core hypothesis, and a deliberate probe of the tension between realism and psychological safety.',
    heard: [
      { t: 'Without screams, without blood, without anything. That’s what throws people off.', p: 'P1' },
      { t: 'Not everyone can see blood; for that person it could become traumatic.', p: 'P1' },
    ],
    assumed: 'More realism is always better training.',
    learned: 'Realism is a dial, not a goal. Too little leaves people unprepared; too much stops them acting at all, which is why public courses already removed even fake blood (P5). Realism became calibrated per tier.',
  },
  {
    theme: 'Team training in VR',
    q: 'If several people trained together in VR, how should they interact, and which roles should be trainable?',
    why: 'This is the question that most directly shaped the collaboration mechanics.',
    heard: [
      { t: 'You have to point at someone and say: you, with the blue jacket, come here, press here — that is the only way it works.', p: 'P4' },
      { t: 'If I have a freshly thrown together team, they’ll always have to talk with each other.', p: 'P6' },
      { t: 'I give an instruction; the colleague confirms they received it and are executing it — without that confirmation the handover has not happened.', p: 'P7' },
    ],
    assumed: 'Assigning roles up front would solve coordination.',
    learned: 'Strangers can’t rely on gestures or labels. They need direct, named instructions and confirmed handovers. These became Explicit Delegation and Task Switching and Handover.',
  },
  {
    theme: 'Feedback and learning',
    q: 'How should debriefing work: during or after, scored or discussed, and what makes it stick?',
    why: 'Training that isn’t retained doesn’t help anyone at a real scene. This shaped the debrief design and the honest framing of evaluation.',
    heard: [
      { t: 'First let them work completely and then subsequently recapitulate the whole thing again.', p: 'P6' },
      { t: 'I only got six out of ten possible points for that, but I don’t know why.', p: 'P1' },
    ],
    assumed: 'A score at the end would tell people how they did.',
    learned: 'Debrief comes after, in order: self-reflection, then peers, then the instructor, supported by a bird’s-eye replay, which VR can offer everyone, not just the first team on scene.',
  },
];

// Seven experts, as in the paper (Table 1). Experience in bands only.
export const PERSONAS = [
  { code: 'P1', role: 'Community responder', experience: 'Driver, no clinical role', pain: 'Took one course for a licence and doesn’t feel confident; sanitised practice doesn’t prepare for the shock of a real scene.', quotes: ['Not everyone can see blood; for that person it could become traumatic.', 'I think language would be better, but then there should be somewhat more or less fixed commands.'], led: 'Realism calibrated per tier; the option to pause or opt out' },
  { code: 'P2', role: 'Emergency paramedic', experience: '12+ years, urban and rural', pain: 'Classroom scenarios remove the uncertainty that makes a real accident hard.', quotes: ['You practice in a dry environment and you do not see what you do not see.', 'You divide them among the individual vehicles.'], led: 'Role Seeding' },
  { code: 'P3', role: 'Paramedic', experience: '12 years, city and rural', pain: 'Stress causes tunnel vision: bystanders fixate on one detail and miss the whole picture.', quotes: ['One of the most important things people can learn is to take a mental step back, get an overview, and then act.'], led: 'Environmental stressors in the scenario' },
  { code: 'P4', role: 'Fire service trainee / EMT', experience: '3.5 years, emergency service and transport', pain: 'Generic appeals for help don’t turn bystanders into helpers.', quotes: ['You have to point at someone and say: you, with the blue jacket, come here, press here — that is the only way it works.'], led: 'Explicit Delegation' },
  { code: 'P5', role: 'Head of first-aid training', experience: 'Course design since 2012, paramedic background', pain: 'The moment learners feel overwhelmed, their willingness to act collapses.', quotes: ['The moment participants feel they have a task that is theirs, the inhibition to act drops sharply.', 'Occupational first-aid courses benefit most from VR for scenarios that simply cannot be staged in reality.'], led: 'Three difficulty tiers' },
  { code: 'P6', role: 'Disaster relief trainer', experience: 'Paramedic and first-aid trainer', pain: 'Nobody owns the emergency call in a group, and courses leave coordination to chance.', quotes: ['No one feels directly addressed — the emergency call gets pushed back and forth in a group.'], led: 'Debrief order: self, peers, instructor' },
  { code: 'P7', role: 'Emergency physician / instructor', experience: 'Anaesthesiology, 5 years emergency medicine', pain: 'Professional teams rely on closed-loop communication that lay responders never learn.', quotes: ['I give an instruction; the colleague confirms they received it and are executing it — without that confirmation the handover has not happened.'], led: 'Task Switching and Handover; bird’s-eye replay' },
];

// Act III: Grounded Theory categories (open → axial → selective coding)
export const CATEGORIES = [
  'Role confusion and absent task ownership',
  'Diffusion of responsibility around the call',
  'Environmental stressors as a training gap',
  'Haptic fidelity as a VR constraint',
  'Debriefing structure drives retention',
];

// Act IV: findings → design decisions
export const MAPPING = [
  { from: 'Nobody owns the emergency call', to: 'Role Seeding', why: 'Give each player information only they can act on, so ownership comes from what they see, not a label.' },
  { from: '“You, with the blue jacket”', to: 'Explicit Delegation', why: 'A point plus a named instruction turns shared awareness into accountable action.' },
  { from: 'Closed-loop confirmation', to: 'Task Switching and Handover', why: 'A swap only counts once both players confirm, which also defuses two people competing to lead.' },
  { from: 'Realism vs. psychological safety', to: 'Three calibrated tiers', why: 'Low intensity to build confidence first; higher fidelity later for those who need stress inoculation.' },
  { from: 'The 8–12 minute window', to: 'Coordination speed as the skill', why: 'The time a bystander team controls before help arrives is what the training is framed around.' },
  { from: 'Self → peers → instructor', to: 'Bird’s-eye replay debrief', why: 'Designed, not yet built: a multi-angle replay everyone can learn from.' },
];

export const MECHANICS = {
  all: { title: 'Three collaboration mechanics', sees: 'Together they reframe the problem from spatial interaction to coordination scaffolding.', does: 'Choose a mechanic to see its hypothesis.', hyp: '' },
  scene: { title: 'Role Seeding', sees: 'Asymmetric information: one player sees the hazards, another the phone prompt, another the casualty’s breathing.', does: 'Roles emerge from what each player can perceive, not from assignment.', hyp: 'H1: Non-uniform cues produce natural role differentiation, reducing diffusion of responsibility while keeping team agency.' },
  people: { title: 'Explicit Delegation', sees: 'A pointing gesture combined with a verbal command: “You, call 112.”', does: 'Converts passive awareness into accountable, coordinated action, logged for the debrief.', hyp: 'H2: Point plus speech moves teams from awareness to action more reliably than either alone.' },
  medical: { title: 'Task Switching and Handover', sees: 'A role swap requested when priorities shift or a CPR helper tires.', does: 'The swap only takes effect once both players confirm it.', hyp: 'H3: Mutual confirmation prevents accidental task abandonment and makes redistribution a team decision.' },
};

export const TIERS = [
  { name: 'Easy', casualties: 1, guidance: 'Guided prompts throughout', realism: 'Low intensity: confidence first', status: 'built' },
  { name: 'Medium', casualties: 2, guidance: 'Minimal system guidance', realism: 'Moderate stressors', status: 'concept' },
  { name: 'Extreme', casualties: 3, guidance: 'No guidance; patient decompensation', realism: 'High fidelity, with trigger warning and opt-out', status: 'concept' },
];

export const PHASES = [
  { title: 'Secure the scene', status: 'built', body: 'Hi-vis vest on, warning triangle placed about 50 m back. Step inside the danger zone before the scene is secured and the run fails.' },
  { title: 'Call 112', status: 'built', body: 'The five W-questions, with the dispatcher confirming each answer before moving on.' },
  { title: 'First aid', status: 'concept', body: 'Positioning the patient, for example elevating the upper body to reduce cardiac load, shown rather than told. Designed from the interviews, not yet built.' },
  { title: 'Hand over', status: 'partial', body: 'The ambulance arrives in the demo once the call is made; the structured handover to the crew is still concept.' },
];

export const MILESTONES = [
  { label: 'Literature gap', detail: 'Existing VR first aid trains individuals; the collaborative, lay cell is empty.', done: true },
  { label: 'Interviews', detail: 'Seven experts, semi-structured, 30–60 minutes each.', done: true },
  { label: 'Analysis', detail: 'Grounded Theory coding until saturation across all seven transcripts.', done: true },
  { label: 'Concept + findings', detail: 'Three collaboration mechanics, three tiers, hypotheses H1–H3.', done: true },
  { label: 'WebXR', detail: 'A working browser prototype: desktop and headset, solo and AI team mode.', done: true },
  { label: 'User study', detail: 'Testing H1–H3 against baselines. Not yet run.', done: false },
  { label: 'Retention', detail: 'Longitudinal study past the 2–6 month decay window. Not yet run.', done: false },
];

export const LIMITS = [
  { k: 'Haptics', body: 'Controllers can click for a compression, but can’t simulate bandaging or a Rautek rescue grip. Sensor-linked manikins are the likely path.' },
  { k: 'Cybersickness', body: 'Still an accessibility barrier for some users.' },
  { k: 'Ethics', body: 'People with a history of road accidents may be at risk from realistic depictions: clear trigger warnings and a simple opt-out are requirements.' },
  { k: 'Adoption', body: 'Setup and briefing time can block use in already tight courses (P6).' },
];
