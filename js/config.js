// ── Configuration Constants ──────────────────────────────────────────────────

export const CONFIG = {
  // Scene
  GROUND_SIZE: 200,
  ROAD_WIDTH: 8,
  ROAD_LENGTH: 200,

  // Collision position (center of the accident)
  COLLISION_POS: { x: 3, y: 0, z: 0 },

  // Warning triangle placement
  TRIANGLE_PLACE_DISTANCE: 50,   // meters behind collision
  TRIANGLE_PLACE_TOLERANCE: 5,   // radius of valid placement zone

  // Victim
  VICTIM_POS: { x: 5.5, y: 0, z: 1.5 },
  VICTIM_FAIL_RADIUS: 4,         // approach radius that triggers fail state

  // Items spawn positions
  VEST_POS: { x: -1, y: 0.9, z: -3 },
  TRIANGLE_POS: { x: -1.5, y: 0.6, z: -4.5 },
  PHONE_POS: { x: -0.5, y: 0.8, z: -3.8 },

  // Player start
  PLAYER_START: { x: -2, y: 0, z: -8 },

  // Teleportation
  TELEPORT_FADE_TIME: 0.15,
  MAX_TELEPORT_DISTANCE: 30,

  // Arrow guide
  ARROW_BOB_SPEED: 0.003,
  ARROW_BOB_AMPLITUDE: 0.05,

  // Audio
  DISTRESS_MAX_DISTANCE: 20,
  DISTRESS_REF_DISTANCE: 2,

  // Scoring
  TIME_EXCELLENT: 120, // seconds
  TIME_GOOD: 240,
  TIME_FAIR: 360,

  // UI colors
  COLOR_PRIMARY: 0x2196f3,
  COLOR_SUCCESS: 0x4caf50,
  COLOR_DANGER: 0xf44336,
  COLOR_WARNING: 0xff9800,
  COLOR_BG_DARK: 0x1a1a2e,
  COLOR_BG_PANEL: 0x16213e,
  COLOR_TEXT: 0xffffff,

  // Game states
  STATES: {
    INTRO: 'INTRO',
    VEST_PICKUP: 'VEST_PICKUP',
    TRIANGLE_PICKUP: 'TRIANGLE_PICKUP',
    TRIANGLE_HELD: 'TRIANGLE_HELD',
    TRIANGLE_PLACED: 'TRIANGLE_PLACED',
    CALLING_112: 'CALLING_112',
    CALL_COMPLETE: 'CALL_COMPLETE',
    APPROACH_VICTIM: 'APPROACH_VICTIM',
    COMPLETE: 'COMPLETE',
    FAIL: 'FAIL',
  },

  // W-questions for 112 call
  W_QUESTIONS: [
    {
      question: 'Wo ist der Notfall? (Where is the emergency?)',
      options: [
        'Hauptstraße 42, near the intersection',
        'I\'m not sure of the exact address',
        'Somewhere on a highway',
      ],
      correct: 0,
    },
    {
      question: 'Was ist passiert? (What happened?)',
      options: [
        'A minor rear-end collision with one injured person',
        'A major pile-up',
        'I don\'t know',
      ],
      correct: 0,
    },
    {
      question: 'Wer ruft an? (Who is calling?)',
      options: [
        'My name is Max, I am a bystander',
        'I prefer not to say',
        'Someone else told me to call',
      ],
      correct: 0,
    },
    {
      question: 'Wie viele Verletzte? (How many are injured?)',
      options: [
        'One person, appears dazed but conscious',
        'Multiple people, I can\'t tell',
        'No one is injured',
      ],
      correct: 0,
    },
    {
      question: 'Warten auf Rückfragen (Wait for further questions)',
      options: [
        'Yes, I will stay on the line',
        'No, I need to hang up now',
      ],
      correct: 0,
    },
  ],

  // Task descriptions per state
  TASK_TEXT: {
    INTRO: 'Welcome to First Aid Training. Click "Start" to begin.',
    VEST_PICKUP: 'Step 1: Put on the high-visibility safety vest.',
    TRIANGLE_PICKUP: 'Step 2: Grab the warning triangle from the boot.',
    TRIANGLE_HELD: 'Place the warning triangle ~50m behind the collision.',
    TRIANGLE_PLACED: 'Scene is secure! Pick up the mobile phone to call 112.',
    CALLING_112: 'Answer the dispatcher\'s questions.',
    CALL_COMPLETE: 'Call complete! Now approach the victim safely.',
    APPROACH_VICTIM: 'Walk towards the victim to provide assistance.',
    COMPLETE: 'Training Complete!',
    FAIL: 'DANGER! You approached the victim without securing the scene!',
  },
};
