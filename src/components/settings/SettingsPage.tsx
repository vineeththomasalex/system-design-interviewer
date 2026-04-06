import { useState, useCallback } from 'react';
import type { AppSettings, KeyValidationResult, InterviewerPersonality } from '../../types/interview';
import { PERSONALITY_PRESETS } from '../../types/interview';
import { validateGeminiKey } from '../../services/gemini/GeminiKeyValidator';

interface Props {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
  onClose: () => void;
}

const SettingsPage: React.FC<Props> = ({ settings, onUpdate, onClose }) => {
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<KeyValidationResult | null>(null);

  const handleValidate = useCallback(async () => {
    setValidating(true);
    setValidation(null);
    const result = await validateGeminiKey(settings.geminiApiKey);
    setValidation(result);
    setValidating(false);
  }, [settings.geminiApiKey]);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* API Configuration */}
          <section className="settings-section">
            <h3>🔑 Gemini API</h3>
            <div className="settings-field">
              <label>API Key</label>
              <div className="settings-key-row">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.geminiApiKey}
                  onChange={e => onUpdate({ geminiApiKey: e.target.value })}
                  placeholder="Enter your Gemini API key"
                  className="settings-input"
                />
                <button className="settings-btn-sm" onClick={() => setShowKey(!showKey)}>
                  {showKey ? '🙈' : '👁️'}
                </button>
                <button
                  className="settings-btn-sm settings-btn-validate"
                  onClick={handleValidate}
                  disabled={validating || !settings.geminiApiKey}
                >
                  {validating ? '⏳' : '✓'} Validate
                </button>
              </div>
              {validation && (
                <div className={`settings-validation ${validation.valid ? 'valid' : 'invalid'}`}>
                  <div>{validation.valid ? '✅' : '❌'} Key {validation.valid ? 'valid' : 'invalid'}</div>
                  {validation.valid && (
                    <>
                      <div>{validation.modelAccessible ? '✅' : '❌'} Live API model accessible</div>
                      <div>{validation.liveApiSupported ? '✅' : '⚠️'} Audio generation supported</div>
                    </>
                  )}
                  {validation.errorMessage && (
                    <div className="settings-validation-error">{validation.errorMessage}</div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Candidate Profile */}
          <section className="settings-section">
            <h3>👤 Candidate Profile</h3>
            <div className="settings-field">
              <label>Name</label>
              <input
                type="text"
                value={settings.candidateName}
                onChange={e => onUpdate({ candidateName: e.target.value })}
                placeholder="Your name"
                className="settings-input"
              />
            </div>
            <div className="settings-row">
              <div className="settings-field">
                <label>Current Role</label>
                <input
                  type="text"
                  value={settings.currentRole}
                  onChange={e => onUpdate({ currentRole: e.target.value })}
                  className="settings-input"
                />
              </div>
              <div className="settings-field">
                <label>Experience</label>
                <select
                  value={settings.experienceLevel}
                  onChange={e => onUpdate({ experienceLevel: e.target.value as AppSettings['experienceLevel'] })}
                  className="settings-select"
                >
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Staff">Staff</option>
                  <option value="Principal">Principal</option>
                </select>
              </div>
            </div>
            <div className="settings-field">
              <label>First Language</label>
              <input
                type="text"
                value={settings.firstLanguage}
                onChange={e => onUpdate({ firstLanguage: e.target.value })}
                className="settings-input"
              />
            </div>
          </section>

          {/* Interview Defaults */}
          <section className="settings-section">
            <h3>🎤 Interview Defaults</h3>
            <div className="settings-field">
              <label>Default Interviewer Personality</label>
              <select
                value={settings.defaultPersonality}
                onChange={e => onUpdate({ defaultPersonality: e.target.value as InterviewerPersonality })}
                className="settings-select"
              >
                {PERSONALITY_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>
                ))}
                <option value="custom">✏️ Custom</option>
              </select>
            </div>
            {settings.defaultPersonality === 'custom' && (
              <div className="settings-field">
                <label>Custom Personality</label>
                <textarea
                  value={settings.customPersonalityPrompt}
                  onChange={e => onUpdate({ customPersonalityPrompt: e.target.value })}
                  placeholder="Describe the interviewer's personality..."
                  className="settings-textarea"
                  rows={3}
                />
              </div>
            )}
            <div className="settings-row">
              <div className="settings-field">
                <label>Default Duration</label>
                <select
                  value={settings.defaultDuration}
                  onChange={e => onUpdate({ defaultDuration: Number(e.target.value) })}
                  className="settings-select"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={50}>50 min</option>
                  <option value={60}>60 min</option>
                </select>
              </div>
              <div className="settings-field">
                <label>Canvas Update Interval</label>
                <select
                  value={settings.canvasUpdateInterval}
                  onChange={e => onUpdate({ canvasUpdateInterval: Number(e.target.value) })}
                  className="settings-select"
                >
                  <option value={10}>10s</option>
                  <option value={20}>20s</option>
                  <option value={30}>30s</option>
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                </select>
              </div>
            </div>
            <div className="settings-toggles">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.autoRecord}
                  onChange={e => onUpdate({ autoRecord: e.target.checked })}
                />
                <span>🎤 Auto-record interviews</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.canvasSharing}
                  onChange={e => onUpdate({ canvasSharing: e.target.checked })}
                />
                <span>📊 Share YAML & notes with interviewer</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.canvasImageSharing}
                  onChange={e => onUpdate({ canvasImageSharing: e.target.checked })}
                />
                <span>🖼️ Share canvas image (includes drawings)</span>
              </label>
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <button className="settings-btn-save" onClick={onClose}>Save & Close</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
