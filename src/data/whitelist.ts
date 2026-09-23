/**
 * Khulna University CSE Batch 25 Whitelist
 * Format: 2502**@ku.ac.bd
 * Valid student numbers: 01 to 43 excluding 10, 16, 17, 27
 */

export const EXCLUDED_STUDENT_NUMBERS = new Set(['10', '16', '17', '27']);

// Pre-registered student profiles for KUCSE25 batch
export const KUCSE25_STUDENT_DIRECTORY: Record<string, { name: string; email: string; isCR?: boolean; isACR?: boolean }> = {
  '250201': { name: 'LAMEYA TABASUM', email: '250201@ku.ac.bd' },
  '250202': { name: 'SK. SAFINUR RAHMAN', email: '250202@ku.ac.bd' },
  '250203': { name: 'DIPU PAUL', email: '250203@ku.ac.bd' },
  '250204': { name: 'NAIMA ALAM', email: '250204@ku.ac.bd' },
  '250205': { name: 'NAYMUR RAHMAN', email: '250205@ku.ac.bd' },
  '250206': { name: 'SUDIP OJHA', email: '250206@ku.ac.bd' },
  '250207': { name: 'ASHRAFUL MUKADDIS SHEETOL', email: '250207@ku.ac.bd' },
  '250208': { name: 'FAHIM JUBAIR', email: '250208@ku.ac.bd' },
  '250209': { name: 'SHAHARIN ZAMAN ROZA', email: '250209@ku.ac.bd' },
  // 10 excluded
  '250211': { name: 'MD. SUHAIL AREFIN RIDOY', email: '250211@ku.ac.bd' },
  '250212': { name: 'ESMATUL HAQUE ERA', email: '250212@ku.ac.bd' },
  '250213': { name: 'ANIK MONDAL', email: '250213@ku.ac.bd' },
  '250214': { name: 'ARITRYA SARKAR TIRTHA', email: '250214@ku.ac.bd' },
  '250215': { name: 'MD. ADIL ISHTIAQUE', email: '250215@ku.ac.bd' },
  // 16, 17 excluded
  '250218': { name: 'SAJU PAUL', email: '250218@ku.ac.bd' },
  '250219': { name: 'ADIL AHNAF SAIKAT', email: '250219@ku.ac.bd' },
  '250220': { name: 'PRITOM DAS', email: '250220@ku.ac.bd' },
  '250221': { name: 'TAUFIQ E ELAHI', email: '250221@ku.ac.bd', isCR: true },
  '250222': { name: 'FAHAD HASSAN', email: '250222@ku.ac.bd' },
  '250223': { name: 'SHAHARIAR KOBIR', email: '250223@ku.ac.bd' },
  '250224': { name: 'KAZI RAHAD ALI', email: '250224@ku.ac.bd' },
  '250225': { name: 'TASNIM ISLAM', email: '250225@ku.ac.bd' },
  '250226': { name: 'SEAM RAHMAN KABBO', email: '250226@ku.ac.bd' },
  // 27 excluded
  '250228': { name: 'MD. JUABAYED', email: '250228@ku.ac.bd' },
  '250229': { name: 'ABDULLAH AL MAMUN', email: '250229@ku.ac.bd' },
  '250230': { name: 'MD. MORSALIN SHAH', email: '250230@ku.ac.bd' },
  '250231': { name: 'AFIF HOSSAIN', email: '250231@ku.ac.bd' },
  '250232': { name: 'MALIHA AFRIN', email: '250232@ku.ac.bd' },
  '250233': { name: 'CHOWDHURY RIFAT AHMED', email: '250233@ku.ac.bd' },
  '250234': { name: 'MUJAHID AL MAHI', email: '250234@ku.ac.bd' },
  '250235': { name: 'MD. SHAHARIAR HOSSAIN JIBON', email: '250235@ku.ac.bd' },
  '250236': { name: 'ARGHA ROY', email: '250236@ku.ac.bd', isACR: true },
  '250237': { name: 'KHONDOKER AHNAF ELAHE', email: '250237@ku.ac.bd' },
  '250238': { name: 'ZAHIN BIN HASAN', email: '250238@ku.ac.bd' },
  '250239': { name: 'PABITRA CHAKMA', email: '250239@ku.ac.bd' },
  '250240': { name: 'MD. HABIBUR RAHMAN', email: '250240@ku.ac.bd' },
  '250241': { name: 'DANISH ANSARI', email: '250241@ku.ac.bd' },
  '250242': { name: 'RAKHI MAHATO', email: '250242@ku.ac.bd' },
  '250243': { name: 'EVAN NIRJON', email: '250243@ku.ac.bd' },
};

/**
 * Validates whether an email belongs to the KUCSE25 whitelist.
 * STRICT KU EMAIL RULE:
 * Format must be exactly: 2502XX@ku.ac.bd
 * Valid student numbers: 01 to 43 excluding 10, 16, 17, 27.
 * Does NOT accept:
 *   - arbitrary @ku.ac.bd
 *   - @cseku.ac.bd
 *   - emails with arbitrary prefixes (e.g. rifat250233@...)
 *   - student IDs outside 250201–250243
 */
export function validateKUCSE25Email(rawEmail: string): {
  isValid: boolean;
  studentId?: string;
  studentNumber?: string;
  name?: string;
  isCR?: boolean;
  isACR?: boolean;
  role?: 'student' | 'cr' | 'acr';
  error?: string;
} {
  const trimmed = (rawEmail || '').trim().toLowerCase();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'Please enter your KU student email address.',
    };
  }

  // Strictly enforce exact format: 2502XX@ku.ac.bd
  // No prefixes, no @cseku.ac.bd, no alternate domains
  const match = trimmed.match(/^2502(\d{2})@ku\.ac\.bd$/);
  if (!match) {
    return {
      isValid: false,
      error: 'This email is not part of the active KUCSE25 student roster.',
    };
  }

  const studentNum = match[1];
  const numInt = parseInt(studentNum, 10);
  const studentId = `2502${studentNum}`;

  // Check batch bounds (01 to 43)
  if (isNaN(numInt) || numInt < 1 || numInt > 43) {
    return {
      isValid: false,
      error: 'This email is not part of the active KUCSE25 student roster.',
    };
  }

  // Check excluded rolls: 10, 16, 17, 27
  if (EXCLUDED_STUDENT_NUMBERS.has(studentNum)) {
    return {
      isValid: false,
      error: 'This email is not part of the active KUCSE25 student roster.',
    };
  }

  // Authoritative directory check from pre-registered KUCSE25 roster
  const directoryEntry = KUCSE25_STUDENT_DIRECTORY[studentId];
  if (!directoryEntry) {
    return {
      isValid: false,
      error: 'This email is not part of the active KUCSE25 student roster.',
    };
  }

  const isCR = !!directoryEntry.isCR;
  const isACR = !!directoryEntry.isACR;
  const role: 'student' | 'cr' | 'acr' = isCR ? 'cr' : isACR ? 'acr' : 'student';

  return {
    isValid: true,
    studentId,
    studentNumber: studentNum,
    name: directoryEntry.name,
    isCR,
    isACR,
    role,
  };
}

export const CR_STUDENT_ID = '250221'; // TAUFIQ E ELAHI (CR)
export const ACR_STUDENT_ID = '250236'; // ARGHA ROY (ACR)
