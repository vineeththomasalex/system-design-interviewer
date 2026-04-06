import type { KeyValidationResult } from '../../types/interview';

const MODELS_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUIRED_MODEL = 'gemini-3.1-flash-live-preview';

/**
 * Validates a Gemini API key by calling the models.list endpoint.
 * Checks: key validity, live model accessibility, bidiGenerateContent support.
 */
export async function validateGeminiKey(apiKey: string): Promise<KeyValidationResult> {
  if (!apiKey.trim()) {
    return { valid: false, modelAccessible: false, liveApiSupported: false, errorMessage: 'API key is empty' };
  }

  try {
    const response = await fetch(`${MODELS_API_URL}?key=${encodeURIComponent(apiKey)}`);

    if (response.status === 401 || response.status === 403) {
      const body = await response.json().catch(() => ({}));
      const msg = body?.error?.message || 'Invalid or expired API key';
      return { valid: false, modelAccessible: false, liveApiSupported: false, errorMessage: msg };
    }

    if (!response.ok) {
      return { valid: false, modelAccessible: false, liveApiSupported: false, errorMessage: `API error: ${response.status}` };
    }

    const data = await response.json();
    const models = data.models || [];

    // Check if the required live model is accessible
    const liveModel = models.find((m: { name: string }) =>
      m.name === `models/${REQUIRED_MODEL}` || m.name === REQUIRED_MODEL
    );

    if (!liveModel) {
      return {
        valid: true,
        modelAccessible: false,
        liveApiSupported: false,
        errorMessage: `Key is valid but model "${REQUIRED_MODEL}" is not accessible. You may need to enable it in your Google AI Studio project.`,
      };
    }

    // Check for bidiGenerateContent support
    const methods: string[] = liveModel.supportedGenerationMethods || [];
    const liveApiSupported = methods.some((m: string) =>
      m.toLowerCase().includes('bidigeneratecontent') || m.toLowerCase().includes('generatecontent')
    );

    return {
      valid: true,
      modelAccessible: true,
      liveApiSupported,
      errorMessage: liveApiSupported ? undefined : 'Model found but Live API (bidiGenerateContent) may not be supported',
    };
  } catch (err) {
    return {
      valid: false,
      modelAccessible: false,
      liveApiSupported: false,
      errorMessage: `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
