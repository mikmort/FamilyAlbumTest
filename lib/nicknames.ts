/**
 * Nickname mapping utility for the Family Album application
 * 
 * Maps common nicknames to formal names to improve person search functionality.
 * Based on common English name variations where the letters differ significantly.
 */

export interface NicknameMap {
  [key: string]: string[];
}

/**
 * Comprehensive nickname mapping
 * Key: formal name (lowercase)
 * Value: array of common nicknames (lowercase)
 */
export const nicknameMap: NicknameMap = {
  // M names
  'michael': ['mike', 'mikey', 'mick', 'mickey'],
  'michelle': ['micky', 'shelly', 'shell'],
  'margaret': ['maggie', 'meg', 'peggy', 'peg'],
  'matthew': ['matt'],
  'melissa': ['missy', 'mel'],
  'melanie': ['mel'],
  
  // J names
  'jonathan': ['jon', 'johnny', 'john'],
  'john': ['johnny', 'jack', 'jon'],
  'jennifer': ['jenny', 'jen'],
  'jessica': ['jess', 'jessie'],
  'jeffrey': ['jeff'],
  'james': ['jim', 'jimmy', 'jamie'],
  'joseph': ['joe', 'joey'],
  'joshua': ['josh'],
  'judith': ['judy'],
  
  // D names
  'daniel': ['dan', 'danny'],
  'david': ['dave', 'davey'],
  'donald': ['don', 'donny'],
  'deborah': ['deb', 'debbie'],
  'dorothy': ['dot', 'dottie'],
  
  // R names
  'robert': ['rob', 'bob', 'bobby', 'robbie'],
  'richard': ['dick', 'rick', 'ricky', 'rich'],
  'rebecca': ['becky', 'becca'],
  'rachel': ['rae'],
  
  // W names
  'william': ['will', 'bill', 'billy', 'willie'],
  'walter': ['walt'],
  
  // E names
  'edward': ['ed', 'eddie', 'ted', 'teddy'],
  'elizabeth': ['liz', 'beth', 'betty', 'eliza', 'lizzie'],
  'eleanor': ['ellie', 'nell'],
  
  // C names
  'christopher': ['chris'],
  'christine': ['chris', 'christy', 'tina'],
  'christina': ['chris', 'christy', 'tina'],
  'catherine': ['cathy', 'kate', 'katie'],
  'charles': ['charlie', 'chuck'],
  'charlotte': ['charlie', 'lottie'],
  
  // A names
  'alexander': ['alex', 'xander'],
  'alexandra': ['alex', 'lexi'],
  'anthony': ['tony'],
  'andrew': ['andy', 'drew'],
  
  // S names
  'samuel': ['sam', 'sammy'],
  'stephanie': ['steph'],
  'susan': ['sue', 'susie'],
  'sarah': ['sara'],
  
  // T names
  'theodore': ['ted', 'teddy'],
  'thomas': ['tom', 'tommy'],
  'timothy': ['tim', 'timmy'],
  
  // V names
  'victoria': ['vicky', 'vicki'],
  'vincent': ['vince', 'vinny'],
  
  // N names
  'nicholas': ['nick', 'nicky'],
  'nicole': ['nikki', 'nicky'],
  'nancy': ['nan'],
  
  // P names
  'patricia': ['pat', 'patty', 'trish'],
  'patrick': ['pat', 'patty'],
  
  // L names
  'lawrence': ['larry'],
  'leonard': ['leo', 'len'],
  
  // K names
  'katherine': ['kathy', 'kate', 'katie', 'kat'],
  'kimberly': ['kim'],
  
  // B names
  'benjamin': ['ben', 'benji'],
  'barbara': ['barb', 'barbie'],
};

/**
 * Create a reverse mapping: nickname -> formal names
 * This allows searching by nickname to find the formal name
 */
export const reverseNicknameMap: { [nickname: string]: string[] } = {};

// Build the reverse map
Object.keys(nicknameMap).forEach(formalName => {
  nicknameMap[formalName].forEach(nickname => {
    if (!reverseNicknameMap[nickname]) {
      reverseNicknameMap[nickname] = [];
    }
    reverseNicknameMap[nickname].push(formalName);
  });
});

/**
 * Get all variations of a name (both formal and nicknames)
 * @param name The name to get variations for
 * @returns Array of name variations including the original name
 */
export function getNameVariations(name: string): string[] {
  const normalizedName = name.toLowerCase().trim();
  const variations = new Set<string>([normalizedName]);
  
  // If the name is a formal name, add its nicknames
  if (nicknameMap[normalizedName]) {
    nicknameMap[normalizedName].forEach(nickname => variations.add(nickname));
  }
  
  // If the name is a nickname, add the formal names it maps to
  if (reverseNicknameMap[normalizedName]) {
    reverseNicknameMap[normalizedName].forEach(formalName => {
      variations.add(formalName);
      // Also add other nicknames of those formal names
      if (nicknameMap[formalName]) {
        nicknameMap[formalName].forEach(nickname => variations.add(nickname));
      }
    });
  }
  
  return Array.from(variations);
}

/**
 * Check if a name matches another name, considering nicknames
 * @param searchTerm The term being searched for
 * @param targetName The name to check against
 * @returns true if the names match (exactly or via nicknames)
 */
export function namesMatch(searchTerm: string, targetName: string): boolean {
  const searchLower = searchTerm.toLowerCase().trim();
  const targetLower = targetName.toLowerCase().trim();
  
  // Direct match
  if (targetLower.includes(searchLower) || searchLower.includes(targetLower)) {
    return true;
  }
  
  // Get all variations of the search term
  const searchVariations = getNameVariations(searchLower);
  
  // Check if any variation matches the target
  return searchVariations.some(variation => 
    targetLower.includes(variation) || variation.includes(targetLower)
  );
}

/**
 * Expand a search query to include nickname variations
 * Useful for OR queries where we want to match any variation
 * @param searchTerm The search term
 * @returns Array of search terms including nickname variations
 */
export function expandSearchWithNicknames(searchTerm: string): string[] {
  const variations = getNameVariations(searchTerm);
  return Array.from(new Set(variations));
}
