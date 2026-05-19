const IntakeProtocolServer = require('../mcp/IntakeProtocolServer');
const IntakeSession = require('../models/IntakeSession');

// ─────────────────────────────────────────────────────────────────────────────
// Stage transition messages
// ─────────────────────────────────────────────────────────────────────────────
//
// Two phases per stage boundary:
//
//   WARNING  — fired 1 turn before the limit.
//              Lets the patient know they'll be moving on soon.
//              Stage does NOT advance. Conversation continues normally.
//
//   TRANSITION — fired when the turn limit is reached.
//                Acknowledges what was covered, signals the move to next topic.
//                Stage advances AFTER this message is delivered.
//
// Messages are stage-specific so they feel contextually appropriate,
// not like a generic "moving on now" system notification.
//
// These are prepended to the LLM reply in chatRoute.js (Step 7b) so the
// patient gets both the transition note AND a proper response to their message.
//
const STAGE_MESSAGES = {
  // Concern → Feelings
  1: {
    warning: "We've been exploring what brought you here, and I want to make sure I understand fully before we move forward.",
    transition: "Thank you for sharing what's been on your mind. I'd like to shift our focus a little — I want to understand more about how all of this has been making you feel emotionally."
  },
  // Feelings → History
  2: {
    warning: "I'm getting a clearer picture of how you've been feeling. I have one more thing I'd like to understand before we move on.",
    transition: "I appreciate you sharing that with me. I'd like to understand this a bit more deeply — I'm curious about whether this is something you've experienced before, or if it feels new to you."
  },
  // History → Impact
  3: {
    warning: "This gives me a much better sense of the history behind what you're going through. I want to explore one more piece of this.",
    transition: "That context is really helpful. I'd like to understand how all of this has been affecting your day-to-day life — things like work, relationships, sleep, or your daily routine."
  },
  // Impact → Closing
  4: {
    warning: "I'm starting to get a fuller picture of how this has been affecting you. There's one more area I want to touch on.",
    transition: "Thank you for being so open about the impact this has had. We're coming toward the end of our conversation — I want to make sure there's nothing important we haven't had a chance to cover."
  },
  // Closing (stage 5 — no next stage, completion handled separately)
  5: {
    warning: '',
    transition: ''
  }
};

/**
 * Skill: AdvanceIntakeStage
 *
 * Two-phase soft transition:
 *
 *   Phase 1 — WARNING (maxTurns - 1):
 *     Returns shouldWarn: true + warningMessage.
 *     Stage does NOT advance. Conversation continues.
 *     chatRoute prepends warningMessage to LLM reply.
 *
 *   Phase 2 — TRANSITION (maxTurns):
 *     Returns shouldTransition: true + transitionMessage.
 *     Stage advances to next stage.
 *     chatRoute prepends transitionMessage to LLM reply.
 *     Patient finishes their current thought before the topic changes.
 *
 * Neither phase interrupts mid-thought: the LLM always generates a
 * contextual reply to the current message. The transition note is woven
 * in as a natural prefix, not a hard stop.
 */
class AdvanceIntakeStage {
  /**
   * @param {Object} session     - IntakeSession mongoose document
   * @param {Object} stageConfig - Current stage config from IntakeProtocolServer
   * @returns {Promise<{
   *   session: Object,
   *   stageConfig: Object,
   *   stageAdvanced: boolean,
   *   shouldWarn: boolean,
   *   shouldTransition: boolean,
   *   warningMessage: string,
   *   transitionMessage: string
   * }>}
   */
  async execute(session, stageConfig) {
    if (!session || !stageConfig) {
      throw new Error('AdvanceIntakeStage requires session and stageConfig.');
    }

    const currentStageKey = String(session.currentStage);
    const currentTurns    = session.stageTurnCounts.get(currentStageKey) || 0;
    const maxTurns        = stageConfig.maxTurns;
    const stageMessages   = STAGE_MESSAGES[session.currentStage] || { warning: '', transition: '' };

    // ── Phase 2: Transition (turn limit reached) ─────────────────────────
    if (currentTurns >= maxTurns) {
      const nextStage = session.currentStage + 1;

      if (nextStage > 5) {
        // All stages complete
        session.isComplete  = true;
        session.completedAt = new Date();
        await session.save();

        return {
          session,
          stageConfig,
          stageAdvanced:    false,
          shouldWarn:       false,
          shouldTransition: false,
          warningMessage:   '',
          transitionMessage: ''
        };
      }

      // Advance to next stage
      session.currentStage = nextStage;
      await session.save();

      const newStageConfig = await IntakeProtocolServer.getStageConfig(nextStage);

      return {
        session,
        stageConfig:      newStageConfig,
        stageAdvanced:    true,
        shouldWarn:       false,
        shouldTransition: true,
        warningMessage:   '',
        transitionMessage: stageMessages.transition || ''
      };
    }

    // ── Phase 1: Warning (1 turn before limit) ───────────────────────────
    //
    // Only fires if:
    //   - There IS a warning message for this stage (stage 5 has none)
    //   - The patient is exactly 1 turn away from the limit
    //   - maxTurns is at least 2 (no point warning on a 1-turn stage)
    //
    const isWarningTurn = (
      stageMessages.warning &&
      maxTurns >= 2 &&
      currentTurns === maxTurns - 1
    );

    if (isWarningTurn) {
      return {
        session,
        stageConfig,
        stageAdvanced:    false,
        shouldWarn:       true,
        shouldTransition: false,
        warningMessage:   stageMessages.warning,
        transitionMessage: ''
      };
    }

    // ── No transition needed ──────────────────────────────────────────────
    return {
      session,
      stageConfig,
      stageAdvanced:    false,
      shouldWarn:       false,
      shouldTransition: false,
      warningMessage:   '',
      transitionMessage: ''
    };
  }
}

module.exports = new AdvanceIntakeStage();