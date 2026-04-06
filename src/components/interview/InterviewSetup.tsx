import { useState, useCallback } from 'react';
import type {
  InterviewConfig,
  InterviewDifficulty,
  InterviewMode,
  InterviewerPersonality,
  AppSettings,
  QuestionTemplate,
} from '../../types/interview';
import { PERSONALITY_PRESETS } from '../../types/interview';
import { QUESTION_TEMPLATES } from '../../data/questionTemplates';

interface Props {
  settings: AppSettings;
  onStart: (config: InterviewConfig) => void;
  onCancel: () => void;
}

const TEMPLATE_EMOJIS: Record<string, string> = {
  'url-shortener': '🔗',
  'chat-system': '💬',
  'twitter-feed': '🐦',
  'video-streaming': '🎬',
  'ride-sharing': '🚗',
  'rate-limiter': '⏱️',
  'search-engine': '🔍',
  'file-storage': '📁',
  'notification-system': '🔔',
  'ecommerce': '🛒',
};

const DIFFICULTY_COLORS: Record<InterviewDifficulty, string> = {
  Easy: 'setup-badge-easy',
  Medium: 'setup-badge-medium',
  Hard: 'setup-badge-hard',
};

const DURATION_OPTIONS = [15, 30, 45, 50, 60] as const;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export default function InterviewSetup({ settings, onStart, onCancel }: Props) {
  const [question, setQuestion] = useState('');
  const [questionTemplateId, setQuestionTemplateId] = useState<string | undefined>(undefined);
  const [showTemplates, setShowTemplates] = useState(false);
  const [company, setCompany] = useState('');
  const [personality, setPersonality] = useState<InterviewerPersonality>(settings.defaultPersonality);
  const [customPersonality, setCustomPersonality] = useState(settings.customPersonalityPrompt);
  const [duration, setDuration] = useState(settings.defaultDuration);
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>('Medium');
  const [mode, setMode] = useState<InterviewMode>('voice');

  const wordCount = countWords(question);
  const isOverWordLimit = wordCount > 50;
  const hasQuestion = question.trim().length > 0;
  const canStart = hasQuestion && !isOverWordLimit;
  const apiKeyMissing = !settings.geminiApiKey;

  const handleTemplateSelect = useCallback((template: QuestionTemplate) => {
    setQuestion(template.description);
    setQuestionTemplateId(template.id);
    setDifficulty(template.difficulty);
    setDuration(template.expectedDuration);
    setShowTemplates(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canStart) return;

    const config: InterviewConfig = {
      question: question.trim(),
      questionTemplateId,
      company: company.trim(),
      personality,
      ...(personality === 'custom' ? { customPersonality: customPersonality.trim() } : {}),
      duration,
      difficulty,
      mode,
    };

    onStart(config);
  }, [canStart, question, questionTemplateId, company, personality, customPersonality, duration, difficulty, mode, onStart]);

  return (
    <div className="setup-overlay" onClick={onCancel}>
      <div className="setup-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="setup-header">
          <h2>New Interview</h2>
          <p className="setup-subtitle">Configure your system design interview session</p>
        </div>

        <div className="setup-body">
          {/* API Key Warning */}
          {apiKeyMissing && (
            <div className="setup-warning">
              ⚠️ Gemini API key not configured. Set it in Settings before starting.
            </div>
          )}

          {/* Question Section */}
          <div className="setup-section">
            <div className="setup-section-header">
              <label className="setup-label">Design Question</label>
              <button
                type="button"
                className="setup-btn setup-btn-toggle"
                onClick={() => setShowTemplates((prev) => !prev)}
              >
                {showTemplates ? '✏️ Custom Question' : '📋 Browse Templates'}
              </button>
            </div>

            {!showTemplates ? (
              <div className="setup-field">
                <input
                  type="text"
                  className="setup-input"
                  placeholder="e.g., Design a distributed cache like Memcached"
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    setQuestionTemplateId(undefined);
                  }}
                  maxLength={500}
                />
                <div className={`setup-word-count ${isOverWordLimit ? 'setup-word-count-over' : ''}`}>
                  {wordCount}/50 words
                </div>
              </div>
            ) : (
              <div className="setup-templates-grid">
                {QUESTION_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`setup-template-card ${questionTemplateId === template.id ? 'setup-template-card-selected' : ''}`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <div className="setup-template-card-header">
                      <span className="setup-template-emoji">
                        {TEMPLATE_EMOJIS[template.id] ?? '📐'}
                      </span>
                      <span className="setup-template-title">{template.title}</span>
                      <span className={`setup-badge ${DIFFICULTY_COLORS[template.difficulty]}`}>
                        {template.difficulty}
                      </span>
                    </div>
                    <p className="setup-template-desc">{template.description}</p>
                    <div className="setup-template-meta">
                      <span>⏱️ {template.expectedDuration} min</span>
                      <span>📌 {template.keyTopics.slice(0, 3).join(', ')}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Configuration Row */}
          <div className="setup-config-row">
            <div className="setup-field">
              <label className="setup-label">Company / Position</label>
              <input
                type="text"
                className="setup-input"
                placeholder="e.g., Google L5"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="setup-field">
              <label className="setup-label">Interviewer</label>
              <select
                className="setup-select"
                value={personality}
                onChange={(e) => setPersonality(e.target.value as InterviewerPersonality)}
              >
                {PERSONALITY_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.emoji} {preset.label}
                  </option>
                ))}
                <option value="custom">🎨 Custom</option>
              </select>
            </div>

            <div className="setup-field">
              <label className="setup-label">Duration</label>
              <select
                className="setup-select"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>

            <div className="setup-field">
              <label className="setup-label">Difficulty</label>
              <select
                className="setup-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as InterviewDifficulty)}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div className="setup-field">
              <label className="setup-label">Mode</label>
              <select
                className="setup-select"
                value={mode}
                onChange={(e) => setMode(e.target.value as InterviewMode)}
              >
                <option value="voice">🎙️ Voice</option>
                <option value="text">💬 Text</option>
              </select>
            </div>
          </div>

          {/* Custom Personality */}
          {personality === 'custom' && (
            <div className="setup-field setup-custom-personality">
              <label className="setup-label">Custom Interviewer Prompt</label>
              <textarea
                className="setup-textarea"
                placeholder="Describe how the interviewer should behave, what to focus on, their tone and style..."
                value={customPersonality}
                onChange={(e) => setCustomPersonality(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="setup-footer">
          <button type="button" className="setup-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="setup-btn setup-btn-primary"
            disabled={!canStart}
            onClick={handleSubmit}
          >
            Begin Interview
          </button>
        </div>
      </div>
    </div>
  );
}
