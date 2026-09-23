/**
 * Khulna University CSE Batch 25 Whitelist
 * Format: 2502**@ku.ac.bd
 * Valid student numbers: 01 to 43 excluding 10, 16, 17, 27
 */

export const EXCLUDED_STUDENT_NUMBERS = new Set(['10', '16', '17', '27']);

// Pre-registered student profiles for KUCSE25 batch
export const KUCSE25_STUDENT_DIRECTORY: Record<string, { name: string; email: string; isCR?: boolean; isACR?: boolean }> = {
  '250201': { name: 'Abdullah Al Mamun', email: '250201@ku.ac.bd' },
  '250202': { name: 'Fahim Muntashir', email: '250202@ku.ac.bd' },
  '250203': { name: 'Nusrat Jahan', email: '250203@ku.ac.bd' },
  '250204': { name: 'Sabbir Hossain', email: '250204@ku.ac.bd' },
  '250205': { name: 'Tanvir Hossain', email: '250205@ku.ac.bd', isCR: true },
  '250206': { name: 'Mehedi Hasan', email: '250206@ku.ac.bd' },
  '250207': { name: 'Sadia Afrin', email: '250207@ku.ac.bd' },
  '250208': { name: 'Kazi Rayhan', email: '250208@ku.ac.bd' },
  '250209': { name: 'Arafat Rahman', email: '250209@ku.ac.bd' },
  // 10 excluded
  '250211': { name: 'Farhan Kabir', email: '250211@ku.ac.bd' },
  '250212': { name: 'Tahmidul Islam', email: '250212@ku.ac.bd', isACR: true },
  '250213': { name: 'Anika Tabassum', email: '250213@ku.ac.bd' },
  '250214': { name: 'Shahadat Hossain', email: '250214@ku.ac.bd' },
  '250215': { name: 'Rakibul Islam', email: '250215@ku.ac.bd' },
  // 16, 17 excluded
  '250218': { name: 'Mahfuzur Rahman', email: '250218@ku.ac.bd' },
  '250219': { name: 'Shakil Ahmed', email: '250219@ku.ac.bd' },
  '250220': { name: 'Nafis Imtiaz', email: '250220@ku.ac.bd' },
  '250221': { name: 'Tasnim Hasan', email: '250221@ku.ac.bd' },
  '250222': { name: 'Joyonto Roy', email: '250222@ku.ac.bd' },
  '250223': { name: 'Nazmul Huda', email: '250223@ku.ac.bd' },
  '250224': { name: 'Sumaiya Akter', email: '250224@ku.ac.bd' },
  '250225': { name: 'Hasan Mahmud', email: '250225@ku.ac.bd' },
  '250226': { name: 'Ariful Islam', email: '250226@ku.ac.bd' },
  // 27 excluded
  '250228': { name: 'Zarin Subah', email: '250228@ku.ac.bd' },
  '250229': { name: 'Sourav Das', email: '250229@ku.ac.bd' },
  '250230': { name: 'Muntasir Billah', email: '250230@ku.ac.bd' },
  '250231': { name: 'Ashraful Alam', email: '250231@ku.ac.bd' },
  '250232': { name: 'Sharmin Sultana', email: '250232@ku.ac.bd' },
  '250233': { name: 'Rifat Ahmed', email: '250233@ku.ac.bd' },
  '250234': { name: 'Dipankar Biswas', email: '250234@ku.ac.bd' },
  '250235': { name: 'Tamanna Ferdous', email: '250235@ku.ac.bd' },
  '250236': { name: 'Shahriar Shuvo', email: '250236@ku.ac.bd' },
  '250237': { name: 'Nayeem Hasan', email: '250237@ku.ac.bd' },
  '250238': { name: 'Protik Mukherjee', email: '250238@ku.ac.bd' },
  '250239': { name: 'Sajib Paul', email: '250239@ku.ac.bd' },
  '250240': { name: 'Kazi Tahsin', email: '250240@ku.ac.bd' },
  '250241': { name: 'Rezwanul Haque', email: '250241@ku.ac.bd' },
  '250242': { name: 'Mahrus Hossain', email: '250242@ku.ac.bd' },
  '250243': { name: 'Samiul Alim', email: '250243@ku.ac.bd' },
};

/**
 * Validates whether an email belongs to the KUCSE25 whitelist.
 * Must match: 2502(01-43)@ku.ac.bd excluding 10, 16, 17, 27
 */
export function validateKUCSE25Email(rawEmail: string): {
  isValid: boolean;
  studentId?: string;
  studentNumber?: string;
  name?: string;
  isCR?: boolean;
  isACR?: boolean;
  error?: string;
} {
  const trimmed = rawEmail.trim().toLowerCase();
  
  if (!trimmed) {
    return { isValid: false, error: 'Email address cannot be empty.' };
  }

  // Strict format: exactly 2502XX@ku.ac.bd with no prefix and only @ku.ac.bd domain
  const regex = /^2502(\d{2})@ku\.ac\.bd$/;
  const match = trimmed.match(regex);

  if (!match) {
    return {
      isValid: false,
      error: 'Invalid format. KUCSE25 student email must follow 2502**@ku.ac.bd with no prefixes.',
    };
  }

  const studentId = match[1]; // e.g. "250233"
  const studentNum = match[2]; // e.g. "33"
  const numInt = parseInt(studentNum, 10);

  if (numInt < 1 || numInt > 43) {
    return {
      isValid: false,
      error: `Roll 2502${studentNum} is outside the KUCSE25 batch boundary (01–43).`,
    };
  }

  if (EXCLUDED_STUDENT_NUMBERS.has(studentNum)) {
    return {
      isValid: false,
      error: `Student ID 2502${studentNum} is excluded from the active KUCSE25 batch roster.`,
    };
  }

  const directoryEntry = KUCSE25_STUDENT_DIRECTORY[studentId];
  const name = directoryEntry ? directoryEntry.name : `KUCSE25 Student (${studentId})`;

  return {
    isValid: true,
    studentId,
    studentNumber: studentNum,
    name,
    isCR: !!directoryEntry?.isCR,
    isACR: !!directoryEntry?.isACR,
  };
}

export const CR_STUDENT_ID = '250205'; // Tanvir Hossain (CR)
export const ACR_STUDENT_ID = '250212'; // Tahmidul Islam (ACR)
