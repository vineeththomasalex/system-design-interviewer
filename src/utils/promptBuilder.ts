import type {
  InterviewConfig,
  AppSettings,
  QuestionTemplate,
} from '../types/interview';
import { PERSONALITY_PRESETS } from '../types/interview';
import { QUESTION_TEMPLATES } from '../data/questionTemplates';

/**
 * Builds the system prompt for the Gemini Live API interviewer.
 */
export function buildSystemPrompt(
  config: InterviewConfig,
  settings: AppSettings,
  template?: QuestionTemplate
): string {
  // Resolve personality description
  const preset = PERSONALITY_PRESETS.find(p => p.id === config.personality);
  const personality =
    config.personality === 'custom'
      ? config.customPersonality || settings.customPersonalityPrompt || 'friendly and professional'
      : preset?.promptModifier || 'friendly and professional';

  const companyText = config.company ? ` at ${config.company}` : '';
  const difficulty = config.difficulty;

  // Candidate info comes from settings
  const candidateName = settings.candidateName || 'the candidate';
  const currentRole = settings.currentRole || 'Software Engineer';
  const experienceLevel = settings.experienceLevel;
  const firstLanguage = settings.firstLanguage || 'English';

  const question = config.question || '';

  // Build follow-up patterns section
  let followUpSection = `When candidate adds a DATABASE: ask about SQL vs NoSQL choice, schema, indexing
When candidate adds a CACHE: ask about write-through vs write-behind, eviction, invalidation
When candidate adds a QUEUE/STREAM: ask about failure handling, exactly-once, dead letter
When candidate adds a LOAD BALANCER: ask about algorithm, sticky sessions
When candidate mentions "microservices": ask about service discovery, distributed transactions
When candidate is silent >90 seconds: gently prompt "What are you thinking about?"
When candidate gives vague answer: "Can you be more specific about how {X} works?"`;

  if (template?.followUpPatterns?.length) {
    followUpSection = template.followUpPatterns.join('\n') + '\n\n' + followUpSection;
  }

  // Build evaluation rubric hints
  let evaluationHints = '';
  if (template?.rubricHints?.length) {
    evaluationHints = `\n\nQUESTION-SPECIFIC RUBRIC HINTS:\n${template.rubricHints.map(h => `- ${h}`).join('\n')}`;
  }

  const prompt = `IDENTITY:
You are a ${personality} system design interviewer${companyText}.
You are conducting a ${difficulty} difficulty system design interview.
Your speaking style is natural, conversational, and concise. Keep responses 
to 2-3 sentences during active design phases. Speak longer only when 
presenting the problem or giving the final assessment.

CANDIDATE:
- Name: ${candidateName}
- Role: ${currentRole} with ${experienceLevel} experience
- Primary language: ${firstLanguage}

QUESTION: ${question}

INTERVIEW STRUCTURE — Follow this classic pattern:

PHASE 1: Introduction & Problem Statement (2-3 min)
- Greet the candidate warmly by name
- Present the problem clearly in 3-4 sentences
- State any specific constraints or scale requirements
- Ask: "Before we dive in, what questions do you have about the requirements?"

PHASE 2: Requirements & Scope (3-5 min)
- Let the candidate ask clarifying questions
- Affirm good questions: "Great question — yes, we should consider that"
- Gently redirect if they jump to solutions too early
- If they don't ask enough questions, prompt: "What about [users/scale/latency]?"
- Help them establish functional and non-functional requirements

PHASE 3: High-Level Design (5-8 min)
- Let candidate propose architecture components
- Ask about API design if they skip it
- Monitor their canvas — reference specific nodes they add
- Probe choices: "Why did you choose {X} over {Y}?"

PHASE 4: Deep Dive (8-12 min)
- Pick 1-2 components to explore deeply
- Classic probes: data model, scaling 10x, failure scenarios, consistency, caching, partitioning
- Reference their canvas: "I see your {node} connects to {node} — tell me more"

PHASE 5: Trade-offs & Wrap-up (3-5 min)
- Signal: "We have about 5 minutes left"
- Ask about trade-offs, improvements, risks
- Let them summarize

PHASE 6: Debrief (when interview ends)
- Warm, constructive assessment
- Score per axis (1-10): Requirements, API Design, Data Modeling, Scalability, Reliability, Communication, Problem Solving
- Scoring guide: 1-3 significant gaps, 4-5 below bar, 6-7 meets bar, 8-9 strong, 10 exceptional

FOLLOW-UP PATTERNS:
${followUpSection}

MONOLOGUE HANDLING:
If the candidate has been speaking for more than 3-4 minutes without pausing, 
and you have a follow-up question, interject naturally when they take a breath.

CANVAS MONITORING:
You will periodically receive the candidate's YAML design and notes.
Reference specific elements naturally. Don't narrate every change.
If the design has obvious gaps, wait for a natural moment to ask.

INTERVIEW SUMMARY:
You may receive periodic INTERVIEW_SUMMARY updates. Use these as ground truth 
for what has been established. Do not contradict decisions listed there.${evaluationHints}`;

  return prompt;
}

/**
 * Detects the question template based on keyword matching.
 * Returns the matching template or undefined if no match found.
 */
export function detectQuestionTemplate(
  question: string
): QuestionTemplate | undefined {
  const lowerQuestion = question.toLowerCase();

  // Simple keyword matching against known templates
  const keywordMap: Record<string, string> = {
    'url shortener': 'url-shortener',
    'bit.ly': 'url-shortener',
    'short url': 'url-shortener',
    'tiny url': 'url-shortener',
    'instagram': 'instagram',
    'photo sharing': 'instagram',
    'image feed': 'instagram',
    'social media feed': 'instagram',
    'twitter': 'twitter',
    'x.com': 'twitter',
    'feed': 'twitter',
    'status updates': 'twitter',
    'youtube': 'youtube',
    'video streaming': 'youtube',
    'video platform': 'youtube',
    'netflix': 'netflix',
    'video service': 'netflix',
    'uber': 'uber',
    'ride sharing': 'uber',
    'ride hailing': 'uber',
    'taxi': 'uber',
    'airbnb': 'airbnb',
    'booking': 'airbnb',
    'accommodation': 'airbnb',
    'hotel': 'airbnb',
    'slack': 'slack',
    'messaging': 'slack',
    'chat application': 'slack',
    'real-time messaging': 'slack',
    'whatsapp': 'slack',
    'discord': 'slack',
    'google docs': 'google-docs',
    'collaborative editing': 'google-docs',
    'document collaboration': 'google-docs',
    'live editing': 'google-docs',
    'notion': 'google-docs',
    'dropbox': 'dropbox',
    'file storage': 'dropbox',
    'cloud storage': 'dropbox',
    'file sync': 'dropbox',
    'google drive': 'dropbox',
    'onedrive': 'dropbox',
    'amazon s3': 'dropbox',
    'cache system': 'cache-system',
    'distributed cache': 'cache-system',
    'memcached': 'cache-system',
    'redis': 'cache-system',
    'caching layer': 'cache-system',
    'content delivery network': 'cdn',
    'cdn': 'cdn',
    'edge caching': 'cdn',
    'global distribution': 'cdn',
    'rate limiter': 'rate-limiter',
    'rate limiting': 'rate-limiter',
    'api throttling': 'rate-limiter',
    'request throttling': 'rate-limiter',
    'database': 'database-design',
    'sql database': 'database-design',
    'data modeling': 'database-design',
    'schema design': 'database-design',
    'search engine': 'search-engine',
    'elasticsearch': 'search-engine',
    'full-text search': 'search-engine',
    'search system': 'search-engine',
    'logging system': 'logging-system',
    'distributed logging': 'logging-system',
    'log aggregation': 'logging-system',
    'elk stack': 'logging-system',
    'monitoring': 'monitoring-system',
    'alerting system': 'monitoring-system',
    'metrics': 'monitoring-system',
    'metrics collection': 'monitoring-system',
    'payment': 'payment-system',
    'payment processing': 'payment-system',
    'stripe': 'payment-system',
    'transaction': 'payment-system',
  };

  // Check each keyword
  for (const [keyword, templateId] of Object.entries(keywordMap)) {
    if (lowerQuestion.includes(keyword)) {
      return QUESTION_TEMPLATES.find((t) => t.id === templateId);
    }
  }

  return undefined;
}
