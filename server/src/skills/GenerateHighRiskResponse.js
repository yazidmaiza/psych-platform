/**
 * GenerateHighRiskResponse
 * Deterministic, non-LLM responder for HIGH risk situations.
 *
 * Two entry points:
 *   execute(message, personaConfig)
 *     → Used on the FIRST high-risk message in a session or after a reset.
 *       Warm, holding response. Tells the patient their psychologist has been
 *       notified. Keeps them present. Does NOT abruptly cut off the conversation.
 *
 *   executeEscalation(message, personaConfig)
 *     → Used on the SECOND consecutive high-risk message.
 *       Stronger urgency. Makes clear a human is actively involved.
 *       Signals that the session is pausing for their safety.
 *
 * Design principles:
 *   - Never just drop a hotline number with no human warmth around it.
 *   - Always tell the patient their psychologist has been notified —
 *     this is the most reassuring thing a clinical platform can say.
 *   - Multiple variants per language so repeated triggers don't feel scripted.
 *   - Low temperature equivalents: factual, grounded, never dramatic.
 */
class GenerateHighRiskResponse {
  /**
   * First HIGH risk response — warm, holding, keeps patient present.
   * @param {string} message        - Patient message (used for language detection)
   * @param {object} personaConfig  - Optional persona config with .language field
   * @returns {Promise<string>}
   */
  async execute(message, personaConfig = {}) {
    const lang      = this.detectLanguage(message, personaConfig);
    const variants  = this.firstResponseVariants();
    const pool      = variants[lang] || variants.english;
    // Rotate through variants so repeated triggers don't feel copy-pasted
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Second consecutive HIGH risk response — clearer urgency, session pausing.
   * @param {string} message
   * @param {object} personaConfig
   * @returns {Promise<string>}
   */
  async executeEscalation(message, personaConfig = {}) {
    const lang      = this.detectLanguage(message, personaConfig);
    const variants  = this.escalationVariants();
    const pool      = variants[lang] || variants.english;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ─────────────────────────────────────────────────────────────────────
  // First-response variants
  // Goal: Make the patient feel held, not processed.
  //       Tell them a real human has been notified.
  //       Keep the door open — don't cut off the conversation.
  // ─────────────────────────────────────────────────────────────────────
  firstResponseVariants() {
    return {
      english: [
        "What you're sharing matters, and I want you to know you're not alone right now. Your psychologist has been notified and will follow up with you. Are you in a safe place at this moment? If you need to speak to someone immediately, the crisis line is available at 190.",

        "I hear that things feel very heavy right now, and I'm glad you're still talking. Your psychologist has been alerted so a real person is aware of what you're going through. Can you tell me — are you physically safe where you are right now? If you need immediate support, please call 190.",

        "You don't have to carry this alone. Your psychologist has been notified and will reach out to you. Right now, the most important thing is your safety — are you in a safe place? If you need to speak to someone immediately, please call 190."
      ],

      french: [
        "Ce que vous partagez est important, et je veux que vous sachiez que vous n'êtes pas seul(e) en ce moment. Votre psychologue a été informé(e) et vous contactera. Êtes-vous dans un endroit sûr en ce moment ? Si vous avez besoin d'une aide immédiate, appelez le 190.",

        "Je comprends que les choses semblent très lourdes en ce moment, et je suis là. Votre psychologue a été alerté(e) — une vraie personne est au courant de ce que vous traversez. Êtes-vous physiquement en sécurité là où vous êtes ? Pour un soutien immédiat, appelez le 190.",

        "Vous n'avez pas à porter ça seul(e). Votre psychologue a été notifié(e) et va vous contacter. Pour l'instant, votre sécurité est ce qui compte le plus — êtes-vous dans un endroit sûr ? Si vous avez besoin d'aide maintenant, appelez le 190."
      ],

      derja: [
        "اللي قلتو مهم، وحابك تعرف إنك مش لوحدك دروك. الطبيب النفسي متاعك عرف بالوضع وبش يتواصل معاك. هل إنت في أمان دروك؟ كان تحتاج تحكي مع حد على طول، اتصل بـ 190.",

        "نفهم باه الأمور صعيبة عليك دروك، وأنا موجود معاك. الطبيب النفسي متاعك تنبه — في شخص حقيقي عارف بيك. هل إنت في مكان آمن دروك؟ كان تحتاج مساعدة فورية، اتصل بـ 190.",

        "ما عليكش تحمل هذا لوحدك. الطبيب النفسي متاعك عرف وبش يتواصل معاك. الأهم دروك هي سلامتك — هل إنت في أمان؟ كان تحتاج حد يحكيك دروك، اتصل بـ 190."
      ]
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Escalation variants (2nd consecutive HIGH risk)
  // Goal: Communicate clearly that the session is pausing for safety.
  //       Stronger urgency without being alarming.
  //       Reinforce that a human is actively involved.
  // ─────────────────────────────────────────────────────────────────────
  escalationVariants() {
    return {
      english: [
        "I'm very concerned about you right now, and I want to make sure you're safe. Your psychologist has been urgently notified and will contact you as soon as possible. I'm pausing our session for now so that a real person can step in. Please call 190 if you need immediate support — you don't have to wait.",

        "What you're going through sounds very serious, and I don't want you to be alone with it. Your psychologist has received an urgent alert and will reach out to you directly. Our session is pausing so that proper human support can take over. If you need someone right now, please call 190.",

        "I'm stopping here because your safety is the only thing that matters right now. Your psychologist has been urgently alerted and is aware of what you've shared. Please reach out to 190 immediately if you need to speak to someone now — and know that your psychologist will follow up with you."
      ],

      french: [
        "Je suis très préoccupé(e) par vous en ce moment et je veux m'assurer que vous êtes en sécurité. Votre psychologue a été notifié(e) d'urgence et vous contactera dès que possible. Je mets notre session en pause pour qu'une vraie personne puisse intervenir. Appelez le 190 si vous avez besoin d'aide immédiate.",

        "Ce que vous traversez semble très sérieux, et je ne veux pas que vous soyez seul(e) avec ça. Votre psychologue a reçu une alerte urgente et vous contactera directement. Notre session est en pause pour que vous puissiez recevoir un soutien humain approprié. Si vous avez besoin de quelqu'un maintenant, appelez le 190.",

        "Je m'arrête ici parce que votre sécurité est la seule chose qui compte en ce moment. Votre psychologue a été alerté(e) d'urgence. Appelez le 190 immédiatement si vous avez besoin de parler à quelqu'un maintenant."
      ],

      derja: [
        "أنا قلقان عليك بزاف دروك وحابي نتأكد باش إنت في أمان. الطبيب النفسي متاعك تنبه على وجه السرعة وبش يتواصل معاك في أقرب وقت. موقفين الجلسة دروك باش شخص حقيقي يتدخل. اتصل بـ 190 كان تحتاج مساعدة دروك.",

        "اللي تعيشو يبان صعيب بزاف، وما حابكش تكون لوحدك فيه. الطبيب النفسي متاعك وصلتلو تنبيه عاجل وبش يتواصل معاك مباشرة. الجلسة موقوفة دروك باش يجي الدعم البشري المناسب. كان تحتاج حد دروك، اتصل بـ 190.",

        "نوقف هنا لأن سلامتك هي الشيء الوحيد المهم دروك. الطبيب النفسي متاعك عرف بكل شيء. اتصل بـ 190 على طول كان تحتاج تحكي مع حد الآن."
      ]
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Language detection — unchanged from original
  // ─────────────────────────────────────────────────────────────────────
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
      if (/[\u0600-\u06FF]/.test(text)) return 'derja';
      if (/\b(je|vous|merci|suis|être|pas|mon|ma)\b/i.test(text)) return 'french';
      return 'english';
    } catch {
      return 'english';
    }
  }
}

module.exports = new GenerateHighRiskResponse();