/**
 * Skill: NormalizeDarijaText
 * Purpose: Standardizes mixed Tunisian Darija input (Arabic and Latin/Arabizi script with numbers) into a unified Arabic script format.
 */
class NormalizeDarijaText {
  /**
   * @param {string} rawInput 
   * @returns {string} Normalized Arabic text
   */
  execute(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') {
      return '';
    }
    
    let text = rawInput.toLowerCase();
    
    // Check if there are any Latin/Arabizi characters or common numbers used in Darija
    // Very basic normalization for demonstration. Can be expanded heavily.
    const arabiziMap = {
      '7': 'ح',
      '9': 'ق',
      '3': 'ع',
      '2': 'ء',
      '5': 'خ',
      '8': 'غ',
      'sh': 'ش',
      'ch': 'ش',
      'kh': 'خ',
      'gh': 'غ',
      'th': 'ث',
      'dh': 'ذ'
    };
    
    // Only apply if the string contains latin characters or digit mappings
    if (/[a-z0-9]/.test(text)) {
      // Direct substring replacement for multi-chars first
      for (const [key, val] of Object.entries(arabiziMap)) {
        if (key.length > 1) {
          text = text.split(key).join(val);
        }
      }
      
      // Replace single chars/digits
      text = text.split('').map(char => arabiziMap[char] || char).join('');
    }
    
    return text;
  }
}

module.exports = new NormalizeDarijaText();
