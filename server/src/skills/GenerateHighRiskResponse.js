/**
 * GenerateHighRiskResponse
 * Deterministic, non-LLM responder for HIGH risk situations.
 * Produces short, template-based responses in English, French, or Tunisian Darija.
 */
class GenerateHighRiskResponse {
  /**
   * Generate a deterministic high-risk response.
   * @param {string} message - user message (used for minimal language heuristics)
   * @param {Object} personaConfig - optional persona config with .language field
   * @returns {Promise<string>} response text
   */
  async execute(message, personaConfig = {}) {
    const lang = this.detectLanguage(message, personaConfig);
    const templates = this.templates();
    return templates[lang] || templates.english;
  }

  detectLanguage(message = '', personaConfig = {}) {
    try {
      const langFromPersona = (personaConfig && personaConfig.language) || '';
      if (langFromPersona) {
        const l = String(langFromPersona).toLowerCase();
        if (l.includes('fr')) return 'french';
        if (l.includes('derja') || l.includes('darija') || l.includes('ar')) return 'derja';
        return 'english';
      }

      const text = String(message || '');
      // Arabic letter heuristic -> Derja
      if (/[\u0600-\u06FF]/.test(text)) return 'derja';

      // Simple French keywords heuristic
      if (/\b(je|vous|merci|suis|être|pas|mon|ma)\b/i.test(text)) return 'french';

      return 'english';
    } catch (e) {
      return 'english';
    }
  }

  templates() {
    return {
      english:
        "I'm really sorry you're feeling this way, and I'm concerned about your safety. Are you safe right now? Please reach out to someone you trust or a professional support service right now.",

      french:
        "Je suis vraiment désolé que vous ressentiez cela, et je suis préoccupé par votre sécurité. Êtes-vous en sécurité en ce moment ? Contactez tout de suite une personne de confiance ou un professionnel de soutien.",

      derja:
        "نحس قداش الوضع صعيب عليك وأنا قلق على سلامتك. هل إنتي توّا في أمان؟ حاول تحكي حالا مع شخص تثق فيه ولا مختص يعاونك."
    };
  }
}

module.exports = new GenerateHighRiskResponse();
