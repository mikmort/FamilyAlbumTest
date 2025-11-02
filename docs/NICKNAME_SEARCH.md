# Nickname Search Feature

## Overview

The Family Album application now supports searching for people using common nicknames in addition to their formal names. This feature makes it easier to find people when you know them by a nickname rather than their formal name.

## How It Works

When you search for a person in the People Selector, the search will automatically match both formal names and common nicknames. For example:

- Searching for "Mike" will find people named "Michael"
- Searching for "Jon" will find people named "Jonathan" or "John"
- Searching for "Jeff" will find people named "Jeffrey"
- Searching for "Dan" will find people named "Daniel"

## Supported Nicknames

The system includes a comprehensive list of common English name nicknames, including:

### Most Common Examples (where letters differ significantly)
- **Michael** ↔ Mike, Mikey, Mick, Mickey
- **Jonathan** ↔ Jon, Johnny, John
- **Jeffrey** ↔ Jeff
- **Daniel** ↔ Dan, Danny
- **Robert** ↔ Rob, Bob, Bobby, Robbie
- **William** ↔ Will, Bill, Billy
- **Elizabeth** ↔ Liz, Beth, Betty, Lizzie
- **Richard** ↔ Dick, Rick, Ricky, Rich
- **Margaret** ↔ Maggie, Meg, Peggy
- **Edward** ↔ Ed, Eddie, Ted, Teddy

### Additional Name Variations
The system includes many more nickname mappings for common names. See `lib/nicknames.ts` for the complete list.

## Search Behavior

The search uses a smart matching algorithm:

1. **Nickname Matching (Priority)**: First checks if the search term matches any nickname variations
2. **Direct Match**: Checks if the search term appears in the person's name
3. **Fuzzy Search (Fallback)**: If no exact or nickname matches are found, falls back to fuzzy matching for typos

## Technical Implementation

The nickname functionality is implemented in:
- **`lib/nicknames.ts`**: Core nickname mapping and utility functions
- **`components/PeopleSelector.tsx`**: Integration with the people search UI

### Key Functions

#### `getNameVariations(name: string): string[]`
Returns all variations of a name including the original and all related nicknames.

```typescript
getNameVariations('Mike')
// Returns: ['mike', 'michael', 'mikey', 'mick', 'mickey']
```

#### `namesMatch(searchTerm: string, targetName: string): boolean`
Checks if two names match, considering nicknames.

```typescript
namesMatch('Mike', 'Michael') // true
namesMatch('Dan', 'Daniel')   // true
```

#### `expandSearchWithNicknames(searchTerm: string): string[]`
Expands a search term to include all nickname variations for broader searching.

## Adding New Nicknames

To add new nickname mappings, edit `lib/nicknames.ts` and add entries to the `nicknameMap` object:

```typescript
export const nicknameMap: NicknameMap = {
  // Formal name (lowercase): [array of nicknames (lowercase)]
  'formal-name': ['nickname1', 'nickname2'],
  // ... existing entries ...
};
```

The system automatically builds a reverse mapping (nickname → formal name) when the application loads.

## Testing

The nickname functionality includes both unit tests and end-to-end tests:

- **E2E Tests**: `tests/nickname-search.spec.ts` - Tests the complete search flow in the UI
- **Manual Testing**: Use the People Selector on the home page and search for nicknames

## Benefits

1. **Improved User Experience**: Users can search using the names they're familiar with
2. **Flexibility**: Supports multiple nicknames per formal name
3. **Bidirectional**: Works both ways (formal name → nickname and nickname → formal name)
4. **Case Insensitive**: All searches are case-insensitive
5. **No Breaking Changes**: Existing search functionality remains intact with fuzzy search fallback

## Examples

### Example 1: Finding Michael
- User types: "Mike"
- System finds: All people with "Michael" in their name
- Also matches: Michelle (has "Mike" as a nickname)

### Example 2: Finding Robert
- User types: "Bob"
- System finds: All people with "Robert" in their name
- Also matches: Anyone with "Bob" as part of their formal name

### Example 3: Partial Matches
- User types: "Mich"
- System finds: Michael, Michelle, etc. (via regular partial matching)
- User types: "Mik"
- System finds: Michael (via nickname "Mike")

## Future Enhancements

Possible future improvements:
1. Add more language-specific nicknames (Spanish, Hebrew, etc.)
2. Allow users to add custom nicknames for specific people
3. Support for regional nickname variations
4. Machine learning to suggest nicknames based on usage patterns
